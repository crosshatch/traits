import { Context, Effect, FileSystem, Layer, Path, Schema as S } from "effect"

/** The workspace's absolute paths: the root of its repository, and its traits directory with what that holds. */
export class LocalPaths extends Context.Service<
  LocalPaths,
  {
    /** The root of the Git repository or worktree the workspace belongs to. */
    readonly root: string
    /** The workspace directory holding trait files and the configuration. */
    readonly directory: string
    /** The workspace configuration file, beside the trait files. */
    readonly config: string
    /** The file recording what each declared source's collection of traits was last updated to. */
    readonly sourcesLock: string
    /** Local state, such as remembered decisions; it ignores itself in Git. */
    readonly cache: string
  }
>()("traits/local/LocalPaths") {}

/** The starting directory is not inside a Git repository or worktree, so there is no workspace root to find. */
export class WorkspaceRootError extends S.TaggedError<WorkspaceRootError>()("WorkspaceRootError", {
  /** The directory the search for a Git root started from. */
  start: S.String.annotateKey({ description: "The directory the search for a Git root started from." })
}) {
  override get message() {
    return `${this.start} is not inside a Git repository, so the traits workspace root cannot be found.`
  }
}

/** The workspace's traits directory is missing or unreadable. */
export class WorkspaceDirectoryError extends S.TaggedError<WorkspaceDirectoryError>()("WorkspaceDirectoryError", {
  /** The traits directory that could not be resolved. */
  path: S.String.annotateKey({ description: "The traits directory that could not be resolved." }),
  /** The underlying file system failure. */
  cause: S.Defect().annotateKey({ description: "The underlying file system failure." })
}) {
  override get message() {
    return `Could not find the traits directory at ${this.path}.`
  }
}

/** Resolves the existing traits directory at the root of the Git repository or worktree containing the current working directory, so it works from any subdirectory. It never creates the directory. */
export const layer = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  // .git is a directory in a repository and a file in a linked worktree or submodule; either marks the root.
  const start = path.resolve()
  let root = yield* fs.realPath(start).pipe(Effect.mapError(() => WorkspaceRootError.make({ start })))
  while (!(yield* fs.exists(path.join(root, ".git")).pipe(Effect.orElseSucceed(() => false)))) {
    const parent = path.dirname(root)
    if (parent === root) {
      return yield* WorkspaceRootError.make({ start })
    }
    root = parent
  }
  const traits = path.join(root, "traits")
  const directory = yield* fs
    .realPath(traits)
    .pipe(Effect.mapError((cause) => WorkspaceDirectoryError.make({ path: traits, cause })))
  return {
    root,
    directory,
    config: path.join(directory, "config.json"),
    sourcesLock: path.join(directory, "sources.lock.json"),
    cache: path.join(directory, ".cache")
  }
}).pipe(Layer.effect(LocalPaths))
