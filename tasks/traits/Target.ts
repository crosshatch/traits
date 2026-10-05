import { Effect, FileSystem, Path, Schema as S } from "effect"

import { git } from "./_util.ts"
import { type Change } from "./Domain.ts"
import { TraitsContext } from "./TraitsContext.ts"

export type Target = typeof Target.Type
export const Target = S.TaggedUnion({
  /** Review staged changes against HEAD. */
  Staged: {},
  /** Review unstaged changes to tracked files against the index. */
  Unstaged: {},
  /** Review full contents of untracked files, excluding Git-ignored files. */
  Untracked: {},
  /** Review staged, unstaged, and untracked changes. */
  Changed: {},
  /** Recursively review repository-relative or absolute directories, including unchanged and hidden files, excluding .git and node_modules. Use ["."] for the repository root. */
  Dirs: { dirs: S.Array(S.String) },
  /** Review complete files using repository-relative or absolute paths. Duplicate paths are reviewed once. */
  Files: { files: S.Array(S.String) }
})

export const normalize = Effect.fn("traits.target.normalize")(function* (target: Target) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  if (target._tag === "Files" || target._tag === "Dirs") {
    const { root: repository } = yield* TraitsContext
    const directories = target._tag === "Dirs" ? target.dirs.map((dir) => path.resolve(repository, dir)) : []
    const files = new Set(target._tag === "Files" ? target.files.map((file) => path.resolve(repository, file)) : [])
    const visited = new Set<string>()
    while (directories.length > 0) {
      const current = directories.pop()!
      if (visited.has(current)) continue
      visited.add(current)
      const entries = yield* fs.glob("{*,.*}", { root: current, exclude: [".git", "node_modules"] })
      for (const entry of entries) {
        const filename = path.resolve(current, entry)
        const info = yield* fs.stat(filename)
        if (info.type === "Directory") directories.push(filename)
        else if (info.type === "File") files.add(filename)
      }
    }
    return yield* Effect.forEach(
      files,
      Effect.fn("traits.target.readFile")(function* (filename) {
        const content = yield* fs.readFileString(filename)
        return { path: path.relative(repository, filename), content: `Full file contents:\n${content}` }
      }),
      { concurrency: "unbounded" }
    )
  }
  const diff = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames"]
  const sections =
    target._tag === "Changed"
      ? ["staged", "unstaged"]
      : target._tag === "Untracked"
        ? []
        : [target._tag === "Staged" ? "staged" : "unstaged"]
  const patches = yield* Effect.forEach(
    sections,
    Effect.fn("traits.target.patches")(function* (section) {
      const args = section === "staged" ? [...diff, "--cached"] : diff
      const filenames = (yield* git([...args, "--name-only", "-z"])).split("\0").filter(Boolean)
      return yield* Effect.forEach(
        filenames,
        Effect.fn("traits.target.patch")(function* (filename) {
          const patch = yield* git([...args, "--", filename])
          return { path: filename, content: `${section} changes:\n${patch}` }
        }),
        { concurrency: "unbounded" }
      )
    }),
    { concurrency: "unbounded" }
  )
  const files: Array<Change> = patches.flat()
  if (target._tag !== "Changed" && target._tag !== "Untracked") return files
  const filenames = (yield* git(["ls-files", "--others", "--exclude-standard", "-z"])).split("\0").filter(Boolean)
  const untracked = yield* Effect.forEach(
    filenames,
    Effect.fn("traits.target.readUntracked")(function* (filename) {
      const content = yield* fs.readFileString(path.resolve(filename))
      return { path: filename, content: `New file contents:\n${content}` }
    }),
    { concurrency: "unbounded" }
  )
  return [...files, ...untracked]
})
