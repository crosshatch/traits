import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Reactivity } from "effect/reactivity"

import * as TraitProjectLock from "../_util/TraitProjectLock.ts"
import { ProjectPaths } from "../ProjectPaths.ts"

const acquire = (directory: string) =>
  TraitProjectLock.acquire.pipe(
    Effect.provideService(ProjectPaths, { projectRoot: directory, traitsDirectory: directory })
  )

it.effect(
  "rejects another process and path aliases, isolates worktrees, and releases on forced exit",
  Effect.fn("test.TraitProjectLock")(
    function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-lock-test-" })
      const root = path.join(directory, "project", ".agents", "traits")
      const fixture = yield* path.fromFileUrl(new URL("./fixtures/holdProjectLock.ts", import.meta.url))
      const child = yield* spawner.spawn(ChildProcess.make(process.execPath, [fixture, root], { stderr: "inherit" }))
      const ready = yield* child.stdout.pipe(Stream.decodeText(), Stream.splitLines, Stream.take(1), Stream.runCollect)
      expect(ready).toEqual(["ready"])
      const canonical = yield* fs.realPath(root)
      yield* spawner.exitCode(ChildProcess.make("git", ["init", "--quiet"], { cwd: path.join(directory, "project") }))
      const server = yield* path.fromFileUrl(new URL("../main.ts", import.meta.url))
      const duplicate = yield* spawner.spawn(
        ChildProcess.make(process.execPath, [server], {
          cwd: path.join(directory, "project", ".agents"),
          stdin: "ignore"
        })
      )
      const diagnostic = yield* duplicate.stderr.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (text, chunk) => text + chunk
        )
      )
      const code = yield* duplicate.exitCode
      expect(code).not.toBe(0)
      expect(diagnostic).toContain(`A Traits MCP server already owns ${canonical}`)
      const alias = path.join(directory, "alias")
      yield* fs.symlink(root, alias)
      for (const contender of [root, alias]) {
        const result = yield* acquire(contender).pipe(Effect.scoped, Effect.result)
        expect(Result.isFailure(result)).toBe(true)
        if (Result.isFailure(result))
          expect(result.failure).toMatchObject({
            _tag: "TraitProjectInUseError",
            directory: canonical
          })
      }
      yield* acquire(path.join(directory, "other-worktree", ".agents", "traits")).pipe(Effect.scoped)
      yield* child.kill({ killSignal: "SIGKILL" })
      const exit = yield* child.exitCode.pipe(Effect.result)
      expect(Result.isFailure(exit)).toBe(true)
      // The persistent database is reused; no stale lock deletion is necessary.
      yield* acquire(root).pipe(Effect.scoped)
      yield* acquire(alias).pipe(Effect.scoped)
    },
    Effect.provide([NodeServices.layer, Reactivity.layer])
  ),
  { timeout: 20000 }
)
