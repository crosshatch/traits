import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Effect, FileSystem, Option, Path } from "effect"
import type { ChildProcessSpawner } from "effect/process"

import type { LocalPaths } from "../local/LocalPaths.ts"
import * as LocalProjectFiles from "../local/LocalProjectFiles.ts"
import { git, localPaths } from "./_localWorkspace.ts"

/** Runs the effect in a temporary Git repository that is a workspace's root. */
const withRepository = <A, E>(
  effect: (
    root: string
  ) => Effect.Effect<A, E, LocalPaths | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    // The real path, since the temporary directory is reached through a symbolic link on some systems.
    const root = yield* Effect.flatMap(fs.makeTempDirectoryScoped(), fs.realPath)
    yield* git(root, "init", "--quiet", "--initial-branch", "main")
    return yield* effect(root).pipe(Effect.provide(localPaths(path.join(root, "traits"))))
  })

layer(NodeServices.layer)((it) => {
  it.effect("lists the files Git tracks or would track, less those the given patterns match", () =>
    withRepository(
      Effect.fn(function* (root) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const files = yield* LocalProjectFiles.make(["**/*.{svg,png}", "pnpm-lock.yaml"])
        yield* fs.makeDirectory(path.join(root, "src", "assets"), { recursive: true })
        yield* fs.makeDirectory(path.join(root, "node_modules", "dependency"), { recursive: true })
        yield* fs.writeFileString(path.join(root, ".gitignore"), "node_modules/\n")
        yield* fs.writeFileString(path.join(root, "src", "tracked.ts"), "tracked")
        yield* fs.writeFileString(path.join(root, "src", "assets", "logo.svg"), "<svg/>")
        yield* fs.writeFileString(path.join(root, "src", "assets", "icon.png"), "png")
        yield* fs.writeFileString(path.join(root, "pnpm-lock.yaml"), "lock")
        yield* fs.writeFileString(path.join(root, "node_modules", "dependency", "index.js"), "ignored")
        yield* git(root, "add", "--all")
        yield* git(root, "commit", "--quiet", "--message", "first")
        yield* fs.writeFileString(path.join(root, "src", "a name with spaces.ts"), "untracked")

        const paths = yield* files.paths
        expect(paths).toEqual([".gitignore", "src/a name with spaces.ts", "src/tracked.ts"])
        expect(files.root.href).toBe(new URL(`file://${root}`).href)
      })
    )
  )

  it.effect("reads a file's text and location, and nothing for one that holds no text", () =>
    withRepository(
      Effect.fn(function* (root) {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const files = yield* LocalProjectFiles.make([])
        yield* fs.writeFileString(path.join(root, "text.ts"), "const café = 1\n")
        yield* fs.writeFile(path.join(root, "image.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe]))
        yield* fs.writeFile(path.join(root, "zeros.bin"), new Uint8Array([0x61, 0x00, 0x62]))
        yield* fs.writeFileString(path.join(root, "deleted.ts"), "gone")
        yield* fs.makeDirectory(path.join(root, "directory"))
        yield* git(root, "add", "--all")
        yield* git(root, "commit", "--quiet", "--message", "first")
        yield* fs.remove(path.join(root, "deleted.ts"))

        const paths = yield* files.paths
        expect(paths).toContain("deleted.ts")
        const text = yield* files.read("text.ts")
        expect(text).toEqual(Option.some({ uri: new URL(`file://${root}/text.ts`), text: "const café = 1\n" }))
        const others = yield* Effect.forEach(["image.png", "zeros.bin", "deleted.ts", "directory"], files.read, {
          concurrency: 1
        })
        expect(others).toEqual([Option.none(), Option.none(), Option.none(), Option.none()])
      })
    )
  )
})
