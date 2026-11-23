import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Config, ConfigProvider, Effect, FileSystem, Layer, Path } from "effect"

import * as LocalEnvFile from "../local/LocalEnvFile.ts"
import { git, localPaths } from "./_localWorkspace.ts"

// A name no directory the tests run from holds, so the current directory never has it.
const name = "traits-test-credentials.env"

layer(NodeServices.layer)((it) => {
  it.effect("finds a .env file in the main worktree when a linked worktree has none, and prefers a nearer one", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* Effect.flatMap(fs.makeTempDirectoryScoped(), fs.realPath)
      const main = path.join(directory, "main")
      const linked = path.join(directory, "linked")
      yield* fs.makeDirectory(main)
      yield* git(main, "init", "--quiet", "--initial-branch", "main")
      yield* fs.writeFileString(path.join(main, "README.md"), "A project.")
      yield* git(main, "add", "--all")
      yield* git(main, "commit", "--quiet", "--message", "first")
      yield* git(main, "worktree", "add", "--quiet", linked)
      yield* fs.writeFileString(path.join(main, name), "KEY=main\n")

      const find = (file: string) =>
        LocalEnvFile.find(file).pipe(Effect.provide(localPaths(path.join(linked, "traits"))))
      const inMain = yield* find(name)
      expect(inMain).toBe(path.join(main, name))

      yield* fs.writeFileString(path.join(linked, name), "KEY=linked\n")
      const nearer = yield* find(name)
      expect(nearer).toBe(path.join(linked, name))

      const missing = yield* Effect.flip(find("missing.env"))
      expect(missing).toMatchObject({ _tag: "EnvFileNotFoundError", file: "missing.env" })
      expect(missing.searched).toEqual([
        path.resolve("missing.env"),
        path.join(linked, "missing.env"),
        path.join(main, "missing.env")
      ])

      // An absolute path is only looked for where it says.
      const absolute = yield* Effect.flip(find(path.join(linked, "missing.env")))
      expect(absolute.searched).toEqual([path.join(linked, "missing.env")])

      // The file fills in what the environment leaves unset, and a file that is named must be found.
      const read = (file: string, env: Record<string, string>) =>
        Effect.all([Config.String("KEY"), Config.String("OTHER")], { concurrency: 1 }).pipe(
          Effect.provide(
            LocalEnvFile.layer({ file }).pipe(
              Layer.provide([
                localPaths(path.join(linked, "traits")),
                ConfigProvider.layer(ConfigProvider.fromEnv({ env }))
              ])
            )
          )
        )
      yield* fs.writeFileString(path.join(linked, name), "KEY=linked\nOTHER=from-file\n")
      const fromFile = yield* read(name, { KEY: "from-environment" })
      expect(fromFile).toEqual(["from-environment", "from-file"])
      const unfound = yield* Effect.flip(read("missing.env", {}))
      expect(unfound._tag).toBe("EnvFileNotFoundError")
    })
  )
})
