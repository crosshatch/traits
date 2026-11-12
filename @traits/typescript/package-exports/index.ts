import { Array, Effect, FileSystem, flow, Option, Path, pipe, Predicate, Record, Schema as S, String } from "effect"
import { Enrichment } from "traits"
import { WorkspaceRoot } from "traits/local"

/** Every file target in an exports value: a path, an array of fallbacks, or nested subpath and condition objects. */
const exportTargets = (value: unknown): ReadonlyArray<string> =>
  Predicate.isString(value)
    ? [value]
    : Array.isArray(value)
      ? Array.flatMap(value, exportTargets)
      : Predicate.isObject(value)
        ? Array.flatMap(Record.values(value), exportTargets)
        : []

/** Tells assessments whether the checked file is an entry point of its nearest package, as declared by package.json exports (or main when there are no exports), which the file itself cannot show. */
export default Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  return Effect.gen(function* () {
    const { input } = yield* Enrichment.EnrichmentContext
    const file = input._tag === "After" ? input.change.after.path : input.change.before.path
    const segments = Array.dropRight(String.split(file, "/"), 1)
    // Nearest enclosing directory first, ending at the workspace root.
    const packageDirectories = Array.map(Array.range(0, segments.length), (depth) =>
      Array.join(Array.dropRight(segments, depth), "/")
    )
    const nearest = yield* Effect.findFirst(packageDirectories, (packageDirectory) =>
      fs.exists(path.join(directory, packageDirectory, "package.json"))
    )
    if (Option.isNone(nearest)) {
      return `No package.json encloses ${file}, so it is not a package entry point.`
    }
    const packageDirectory = nearest.value
    const manifestFile = packageDirectory === "" ? "package.json" : `${packageDirectory}/package.json`
    const manifest = yield* fs.readFileString(path.join(directory, manifestFile)).pipe(
      Effect.flatMap(
        S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              name: S.String.pipe(S.optionalKey),
              main: S.String.pipe(S.optionalKey),
              exports: S.Unknown.pipe(S.optionalKey)
            })
          )
        )
      ),
      Effect.mapError(() =>
        Enrichment.EnrichmentError.make({
          reason: Enrichment.EnrichmentErrorReason.cases.Enrichment.make({}),
          instruction: `Fix ${manifestFile} so it is valid JSON with string name and main fields, then check again.`
        })
      )
    )
    const declared =
      manifest.exports === undefined
        ? manifest.main === undefined
          ? []
          : [manifest.main]
        : exportTargets(manifest.exports)
    const entryPoints = pipe(
      declared,
      Array.filter((target) => String.startsWith("./")(target) || !String.includes(":")(target)),
      // Workspace paths are POSIX and relative, so drop the leading ./ of each package-relative target.
      Array.map(
        flow(String.replace(/^\.\//u, ""), (target) =>
          packageDirectory === "" ? target : `${packageDirectory}/${target}`
        )
      ),
      Array.dedupe
    )
    const name = manifest.name === undefined ? manifestFile : `${manifest.name} (${manifestFile})`
    const listed = Array.isArrayEmpty(entryPoints)
      ? "declares no entry points"
      : `declares these entry points: ${Array.join(entryPoints, ", ")}`
    return Array.contains(entryPoints, file)
      ? `${file} is an entry point of package ${name}, which ${listed}.`
      : `${file} is not a package entry point; it is internal to package ${name}, which ${listed}.`
  })
})
