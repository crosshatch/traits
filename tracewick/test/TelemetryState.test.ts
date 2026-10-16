import { layer } from "@effect/vitest"
import { Context, Effect, FileSystem, Layer, PlatformError, Schedule, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { expect } from "vite-plus/test"

import { discover, ensureCollector, post, query, resetTelemetryState, stopCollector } from "../client.ts"
import PackageJson from "../package.json" with { type: "json" }
import { resolveProject } from "../project.ts"
import * as Store from "../store.ts"
import * as TelemetryState from "../TelemetryState.ts"
import { layer as services } from "./Services.ts"

// Subprocess startup, HTTP and PID polling must use real services, not TestClock.
const liveTests = layer(services, { excludeTestServices: true })

liveTests((it) => {
  it.effect("requires a version in metadata and retains the decoding cause", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-missing-version-"
      })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "existing database")
      yield* fs.writeFileString(`${group.state}/metadata.json`, JSON.stringify({ format: 1 }))
      const error = yield* TelemetryState.inspect(group).pipe(Effect.flip)
      expect(error).toBeInstanceOf(TelemetryState.TelemetryResetRequired)
      expect(error).toMatchObject({ cause: { _tag: "SchemaError" } })
      const unchanged = yield* fs.readFileString(`${group.state}/telemetry.sqlite`)
      expect(unchanged).toBe("existing database")
    })
  )

  it.effect("does not turn metadata permission errors into an unknown version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-metadata-permission-"
      })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "existing database")
      const denied = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "readFileString",
        pathOrDescriptor: `${group.state}/metadata.json`
      })
      const error = yield* TelemetryState.inspect(group).pipe(
        Effect.provideService(FileSystem.FileSystem, { ...fs, readFileString: () => denied }),
        Effect.flip
      )
      expect(error).toBe(denied)
    })
  )

  it.effect("warns on an upgrade before launching a command and never prompts on protocol stdin", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-upgrade-cli-"
      })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "old telemetry")
      yield* fs.writeFileString(`${group.state}/cache.json`, JSON.stringify({ format: 1, version: "previous-version" }))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [
            new URL("../cli.ts", import.meta.url).pathname,
            "--project",
            directory,
            "--",
            process.execPath,
            "-e",
            'process.stdout.write("CHILD STARTED")'
          ],
          { stdin: "ignore" }
        )
      )
      const outputs = [
        Stream.mkString(child.stdout.pipe(Stream.decodeText())),
        Stream.mkString(child.stderr.pipe(Stream.decodeText())),
        child.exitCode
      ] as const
      const result = yield* Effect.all(outputs, { concurrency: "unbounded" })
      expect(Number(result[2])).not.toBe(0)
      expect(result[0]).toBe("")
      expect(result[1]).toContain("will delete")
      expect(result[1]).toContain("tracewick reset")
      const preserved = yield* fs.readFileString(`${group.state}/telemetry.sqlite`)
      expect(preserved).toBe("old telemetry")
    })
  )

  it.effect("keeps a foreground collector alive after startup and rejects a duplicate collector", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-foreground-"
      })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const args = [new URL("../cli.ts", import.meta.url).pathname, "collect", "--project", directory]
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, args, { stdout: "ignore", stderr: "ignore", forceKillAfter: "2 seconds" })
      )
      const ready = yield* discover(directory).pipe(
        Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 100 })
      )
      expect(ready.pid).toBe(Number(child.pid))
      const duplicate = yield* spawner.spawn(ChildProcess.make(process.execPath, args, { stdin: "ignore" }))
      const outputs = [
        Stream.mkString(duplicate.stdout.pipe(Stream.decodeText())),
        Stream.mkString(duplicate.stderr.pipe(Stream.decodeText())),
        duplicate.exitCode
      ] as const
      const result = yield* Effect.all(outputs, { concurrency: "unbounded" })
      expect(Number(result[2])).not.toBe(0)
      expect(result[0]).toBe("")
      expect(result[1]).toContain("already running")
      const stillRunning = yield* discover(directory)
      expect(stillRunning.instance).toBe(ready.instance)
      yield* resetTelemetryState(directory)
    })
  )

  it.effect("fails closed if an existing collector process cannot be contacted", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-unreachable-"
      })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "do not delete")
      yield* fs.writeFileString(
        `${group.state}/collector.json`,
        JSON.stringify({ endpoint: "http://127.0.0.1:1", instance: "unreachable", pid: process.pid })
      )
      const failed = yield* resetTelemetryState(directory).pipe(Effect.isFailure)
      expect(failed).toBe(true)
      const preserved = yield* fs.readFileString(`${group.state}/telemetry.sqlite`)
      expect(preserved).toBe("do not delete")
    })
  )

  it.effect("clears stale discovery only after confirming the recorded process is gone", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-stale-reset-"
      })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "old telemetry store")
      yield* fs.writeFileString(
        `${group.state}/collector.json`,
        JSON.stringify({ endpoint: "http://127.0.0.1:1", instance: "stale", pid: 2147483647 })
      )
      yield* resetTelemetryState(directory)
      const exists = yield* fs.exists(`${group.state}/telemetry.sqlite`)
      expect(exists).toBe(false)
    })
  )

  it.effect("creates tables from TypeScript with headless push and preserves same-version data", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-drizzle-" })
      const group = yield* resolveProject(directory)
      yield* Effect.gen(function* () {
        const context = yield* Layer.build(Store.layer({ group }))
        const store = Context.get(context, Store.Store)
        yield* store.log({ runId: "same-version", text: "preserved", kind: "stderr" })
      }).pipe(Effect.scoped)
      const metadata = yield* fs.readFileString(`${group.state}/metadata.json`)
      expect(metadata).toContain(PackageJson.version)
      yield* Effect.gen(function* () {
        const context = yield* Layer.build(Store.layer({ group }))
        const result = yield* Context.get(context, Store.Store).query("logs", {})
        expect(JSON.stringify(result)).toContain("preserved")
      }).pipe(Effect.scoped)
    })
  )

  it.effect("reads legacy metadata without resetting existing telemetry", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-metadata-" })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(`${group.state}/telemetry.sqlite`, "existing database")
      yield* fs.writeFileString(
        `${group.state}/cache.json`,
        JSON.stringify({ format: 1, version: PackageJson.version })
      )
      const state = yield* TelemetryState.inspect(group)
      expect(state).toEqual({ fresh: false })
    })
  )

  it.effect("refuses legacy or invalid telemetry stores without opening or modifying their database", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-legacy-" })
      const group = yield* resolveProject(directory)
      const database = `${group.state}/telemetry.sqlite`
      yield* fs.writeFileString(database, "old database sentinel")
      const result = yield* Layer.build(Store.layer({ group })).pipe(Effect.scoped, Effect.flip)
      expect(result).toBeInstanceOf(TelemetryState.TelemetryResetRequired)
      expect(result.message).toContain("delete")
      const unchanged = yield* fs.readFileString(database)
      expect(unchanged).toBe("old database sentinel")
      yield* fs.writeFileString(`${group.state}/cache.json`, "not JSON")
      const invalid = yield* TelemetryState.inspect(group).pipe(Effect.flip)
      expect(invalid).toBeInstanceOf(TelemetryState.TelemetryResetRequired)
      const stillUnchanged = yield* fs.readFileString(database)
      expect(stillUnchanged).toBe("old database sentinel")
    })
  )

  it.effect("blocks reuse of an old running collector, then explicitly resets only the telemetry state files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "tracewick-upgrade-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      const collector = yield* ensureCollector(directory)
      yield* post(collector, "/api/v1/log", { runId: "old", text: "old telemetry", kind: "stderr" })
      const group = yield* resolveProject(directory)
      yield* fs.writeFileString(
        `${group.state}/metadata.json`,
        JSON.stringify({ format: 1, version: "previous-version" })
      )
      yield* fs.writeFileString(`${group.state}/keep.txt`, "unrelated file")
      const blocked = yield* ensureCollector(directory).pipe(Effect.flip)
      expect(blocked).toBeInstanceOf(TelemetryState.TelemetryResetRequired)
      const oldData = yield* post(collector, "/api/v1/query", { operation: "logs", query: {} })
      expect(JSON.stringify(oldData)).toContain("old telemetry")
      yield* resetTelemetryState(directory)
      const preserved = yield* fs.readFileString(`${group.state}/keep.txt`)
      expect(preserved).toBe("unrelated file")
      const oldDatabaseExists = yield* fs.exists(`${group.state}/telemetry.sqlite`)
      expect(oldDatabaseExists).toBe(false)
      const newData = yield* query("logs", {}, directory)
      expect(newData.items).toEqual([])
      const metadata = yield* fs.readFileString(`${group.state}/metadata.json`)
      expect(metadata).toContain(PackageJson.version)
    })
  )

  it.effect("requires explicit non-interactive reset approval and warns before deleting", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: "/tmp/opencode",
        prefix: "tracewick-reset-cli-"
      })
      const group = yield* resolveProject(directory)
      const database = `${group.state}/telemetry.sqlite`
      yield* fs.writeFileString(database, "old sentinel")
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [new URL("../cli.ts", import.meta.url).pathname, "reset", "--project", directory],
          { stdin: "ignore" }
        )
      )
      const completion = [
        Stream.mkString(child.stdout.pipe(Stream.decodeText())),
        Stream.mkString(child.stderr.pipe(Stream.decodeText())),
        child.exitCode
      ] as const
      const result = yield* Effect.all(completion, { concurrency: "unbounded" })
      expect(Number(result[2])).not.toBe(0)
      expect(result[1]).toContain("WARNING")
      expect(result[1]).toContain("--yes")
      const unchanged = yield* fs.readFileString(database)
      expect(unchanged).toBe("old sentinel")
      const approved = yield* spawner.spawn(
        ChildProcess.make(
          process.execPath,
          [new URL("../cli.ts", import.meta.url).pathname, "reset", "--yes", "--project", directory],
          { stdin: "ignore" }
        )
      )
      const approvalCompletion = [
        Stream.runDrain(approved.stdout),
        Stream.mkString(approved.stderr.pipe(Stream.decodeText())),
        approved.exitCode
      ] as const
      const approval = yield* Effect.all(approvalCompletion, { concurrency: "unbounded" })
      expect(Number(approval[2])).toBe(0)
      expect(approval[1]).toContain("WARNING")
      const exists = yield* fs.exists(database)
      expect(exists).toBe(false)
    })
  )
})
