import { Effect, pipe, Schema as S, SchemaTransformation, String } from "effect"
import { resolve as resolveImport } from "import-meta-resolve"

/** An absolute file URL resolved by the host before constructing a static trait; never a relative path or package name. */
export type ModuleSpecifier = typeof ModuleSpecifier.Type
export const ModuleSpecifier = S.URLFromString.check(
  S.makeFilter((url) => url.protocol === "file:", { message: "Expected a file URL." }),
  S.makeFilter((url) => !pipe(url.href, String.includes("?")) && !pipe(url.href, String.includes("#")), {
    message: "Extension file URLs must not contain queries or fragments."
  })
)
  .pipe(S.decodeTo(S.String, SchemaTransformation.urlFromString.flip()), S.brand("traits/ModuleSpecifier"))
  .annotate({
    description:
      "An absolute file URL resolved by the host before constructing a static trait; no package names, relative paths, queries, or fragments."
  })

/** An extension reference and the explicit file URL supplying its resolution context. */
export type ResolveInput = typeof ResolveInput.Type
export const ResolveInput = S.Struct({
  /** The unresolved reference supplied by the host, not extension source text. */
  reference: S.String.annotate({
    description: "The unresolved extension path or ESM package reference supplied by the host."
  }),
  /** The explicit trait-file or host-module file URL used as the resolution base. */
  baseUrl: S.URL.annotate({
    description: "The explicit trait-file or host-module file URL used as the resolution base."
  })
}).annotate({ description: "An extension reference and the explicit file URL supplying its resolution context." })

/** A host could not resolve an extension reference relative to its explicit file URL base. */
export class ModuleResolutionError extends S.TaggedError<ModuleResolutionError>()("ModuleResolutionError", {
  input: ResolveInput,
  /** The original resolution or validation failure; not serialized into check diagnostics. */
  cause: S.Defect().annotate({
    description: "The original resolution or validation failure, kept outside check diagnostics."
  })
}) {
  override get message(): string {
    return `Could not resolve extension ${this.input.reference} from ${this.input.baseUrl.href}.`
  }
}

/** Resolves an ESM reference from a trait file or explicit host-module URL, not from the traits installation. */
export const resolve = (input: ResolveInput) =>
  Effect.try({
    try: () => resolveImport(input.reference, input.baseUrl.href),
    catch: (cause) => ModuleResolutionError.make({ input, cause })
  }).pipe(
    Effect.flatMap(S.decodeUnknownEffect(ModuleSpecifier)),
    Effect.catchTags({
      SchemaError: (cause) => ModuleResolutionError.make({ input, cause })
    })
  )
