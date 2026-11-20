import * as Git from "@distilled.cloud/github/git"
import * as Repos from "@distilled.cloud/github/repos"
import { Array, Effect, FileSystem, Order, Path, pipe, Schema as S, String } from "effect"
import { Base64 } from "effect/encoding"

import { scrape } from "../ingest.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

export interface SourceFile {
  readonly path: string
  readonly text: string
}

export interface SourceContent {
  readonly files: ReadonlyArray<SourceFile>
  readonly remote: boolean
  readonly ref?: string | undefined
  readonly branch?: string | undefined
}

/** The source reference or its contents cannot be ingested as requested. */
export class SourceError extends S.TaggedError<SourceError>()("SourceError", {
  /** Which source needs correction and how it was rejected. */
  message: S.String.annotateKey({ description: "Which source needs correction and how it was rejected." })
}) {}

/** Remote references are retained as metadata keys; local paths are never tracked. */
export const isRemote = (source: string) => /^(https?:\/\/|git@)/u.test(source)

/** GitHub directories use a tree listing and immutable blobs, avoiding a contents request per directory. */
const github = Effect.fn("IngestionSource.github")(function* (source: string, deep: boolean, branchOverride?: string) {
  const url = yield* pipe(
    source,
    String.replace(/^git@github.com:/u, "https://github.com/"),
    S.decodeEffect(S.URLFromString)
  )
  const [owner, repository, kind, urlRef, ...segments] = pipe(
    url.pathname,
    String.split("/"),
    Array.filter((part) => part !== "")
  )
  if (owner === undefined || repository === undefined || (kind !== undefined && kind !== "tree" && kind !== "blob")) {
    return yield* SourceError.make({ message: `Unsupported GitHub source: ${source}` })
  }
  const repo = pipe(repository, String.replace(/\.git$/u, ""))
  const coordinates = { owner, repo }
  const info = yield* Repos.get(coordinates)
  const decoded = yield* Effect.try({
    try: () => Array.map(urlRef === undefined ? segments : [urlRef, ...segments], decodeURIComponent),
    catch: () => SourceError.make({ message: `Invalid URL escaping in ${source}. Correct the source URL.` })
  })
  const ref = branchOverride ?? (urlRef !== undefined ? decoded[0]! : info.default_branch)
  const branch = /^[\da-f]{40}$/iu.test(ref) ? info.default_branch : ref
  const commit = yield* Repos.getCommit({ ...coordinates, ref })
  const prefix = pipe(decoded, Array.drop(urlRef === undefined ? 0 : 1), Array.join("/"))
  if (kind === "blob") {
    const file = yield* Repos.getContent({ ...coordinates, path: prefix, ref: commit.sha })
    if (Array.isArray(file) || file.type !== "file") {
      return yield* SourceError.make({ message: `Not a regular GitHub file: ${source}` })
    }
    const blob = file.encoding === "base64" ? file : yield* Git.getBlob({ ...coordinates, file_sha: file.sha })
    const text = yield* Effect.fromResult(Base64.decodeString(pipe(blob.content, String.replace(/\s/gu, ""))))
    return { files: [{ path: prefix, text }], remote: true, ref: commit.sha, branch } satisfies SourceContent
  }
  const tree = yield* Git.getTree({ ...coordinates, tree_sha: commit.commit.tree.sha, recursive: "1" })
  if (tree.truncated) {
    return yield* SourceError.make({
      message: `GitHub truncated the tree for ${source}; use a smaller repository source.`
    })
  }
  const entries = Array.filter(tree.tree, (entry) => {
    if (entry.type !== "blob" || entry.path === "" || entry.sha === "" || entry.mode === "120000") {
      return false
    }
    if (prefix !== "" && !pipe(entry.path, String.startsWith(`${prefix}/`))) {
      return false
    }
    const relative = prefix !== "" ? pipe(entry.path, String.slice(prefix.length + 1)) : entry.path
    return deep || pipe(relative, String.split("/")).length <= 2
  })
  if (entries.length === 0) {
    return yield* SourceError.make({ message: `No files found at ${source}.` })
  }
  const files = yield* Effect.forEach(
    entries,
    Effect.fn("IngestionSource.blob")(function* (entry) {
      const blob = yield* Git.getBlob({ ...coordinates, file_sha: entry.sha! })
      if (blob.encoding !== "base64") {
        return yield* SourceError.make({ message: `Unsupported GitHub encoding: ${blob.encoding}` })
      }
      const text = yield* Effect.fromResult(Base64.decodeString(pipe(blob.content, String.replace(/\s/gu, ""))))
      return { path: entry.path!, text }
    }),
    { concurrency: 8 }
  )
  return { files, remote: true, ref: commit.sha, branch } satisfies SourceContent
})

/** Loads source text without model inference; callers can compare hashes before paying for extraction. */
export const load = Effect.fn("IngestionSource.load")(function* (
  source: string,
  deep: boolean = false,
  branch?: string
) {
  if (/^(https:\/\/github\.com\/|git@github\.com:)/u.test(source)) {
    return yield* github(source, deep, branch)
  }
  if (isRemote(source)) {
    return { files: [{ path: source, text: yield* scrape(source) }], remote: true }
  }
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const files: Array<SourceFile> = []
  const visited = new Set<string>()
  const visit = Effect.fn("IngestionSource.visit")(function* (
    file: string,
    depth: number
  ): Effect.fn.Return<void, import("effect/PlatformError").PlatformError> {
    const canonical = yield* fs.realPath(file)
    if (visited.has(canonical)) {
      return
    }
    visited.add(canonical)
    const stat = yield* fs.stat(file)
    if (stat.type === "Directory") {
      if (depth < 0) {
        return
      }
      const children = yield* fs.readDirectory(file)
      for (const child of Array.sort(children, Order.String)) yield* visit(path.join(file, child), depth - 1)
    } else if (stat.type === "File") {
      const text = yield* fs.readFileString(file)
      files.push({ path: file, text })
    }
  })
  yield* visit(path.resolve(directory, source), deep ? Infinity : 1)
  return { files, remote: false }
})
