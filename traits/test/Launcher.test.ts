import { layer } from "@effect/vitest"
import { Config, Effect, FileSystem, Path, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { query, stopCollector } from "tracewick/client"
import { expect } from "vite-plus/test"

import { services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

liveTests((it) => {
  it.effect("rejects the removed endpoint flag without starting the server", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path
      const main = yield* path.fromFileUrl(new URL("../main.ts", import.meta.url))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [main, "--otlp-endpoint", "http://127.0.0.1:4318"], { stdin: "ignore" })
      )
      const completion = [
        Stream.mkString(child.stdout.pipe(Stream.decodeText())),
        Stream.mkString(child.stderr.pipe(Stream.decodeText())),
        child.exitCode
      ] as const
      const result = yield* Effect.all(completion, { concurrency: "unbounded" })
      expect(Number(result[2])).not.toBe(0)
      expect(result[0]).not.toContain("--otlp-endpoint")
      expect(result[1]).toContain("otlp-endpoint")
    })
  )

  it.effect("installs once, then supervises main through tracewick while preserving arguments and stdout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "traits-bootstrap-" })
      yield* Effect.addFinalizer(() => stopCollector(directory).pipe(Effect.ignore))
      yield* fs.writeFileString(
        `${directory}/package.json`,
        JSON.stringify({ name: "bootstrap-test", private: true, packageManager: "npm@11.0.0" })
      )
      yield* fs.makeDirectory(`${directory}/bin`)
      const installer = `${directory}/bin/npm`
      yield* fs.writeFileString(
        installer,
        `#!${process.execPath}\nprocess.stdout.write("installer stdout\\n"); process.stderr.write("installer stderr\\n");\n`
      )
      yield* fs.chmod(installer, 0o755)
      const originalPath = yield* Config.String("PATH")
      const bin = yield* path.fromFileUrl(new URL("../bin.ts", import.meta.url))
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const child = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [bin, "--help"], {
          cwd: directory,
          env: { PATH: `${directory}/bin:${originalPath}` },
          extendEnv: true,
          stdin: "ignore"
        })
      )
      const completion = [
        Stream.mkString(child.stdout.pipe(Stream.decodeText())),
        Stream.mkString(child.stderr.pipe(Stream.decodeText())),
        child.exitCode
      ] as const
      const result = yield* Effect.all(completion, { concurrency: "unbounded" })
      expect(Number(result[2])).toBe(0)
      expect(result[0]).toContain("traits")
      expect(result[0]).not.toContain("otlp-endpoint")
      expect(result[0]).not.toContain("installer stdout")
      expect(result[1]).toContain("installer stdout")
      expect(result[1]).toContain("installer stderr")
      const runs = yield* query("runs", { name: "traits" }, directory)
      expect(runs.items).toHaveLength(1)
      expect(JSON.stringify(runs)).toContain("main.ts")
      expect(JSON.stringify(runs)).toContain('"exitCode":0')
    })
  )
})
