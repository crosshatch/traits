import { Array, Effect, FileSystem, Option, Path, pipe, Record, String } from "effect"
import { Enrichment } from "traits"
import { WorkspaceRoot } from "traits/local"
import { type Identifier, type Statement, SyntaxKind } from "typescript/unstable/ast"
import {
  isClassDeclaration,
  isEnumDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isTypeAliasDeclaration,
  isVariableStatement
} from "typescript/unstable/ast/is"
import { API } from "typescript/unstable/sync"

/** The most referencing files listed per symbol; the rest are counted. */
const filesPerSymbol = 10

/** The name and kind of the declaration an exported top-level statement introduces, if any. */
const exportedDeclaration = (
  statement: Statement
): { readonly name: Identifier; readonly kind: string } | undefined => {
  const declared = isVariableStatement(statement)
    ? { modifiers: statement.modifiers, name: statement.declarationList.declarations[0]?.name, kind: "const" }
    : isClassDeclaration(statement)
      ? { modifiers: statement.modifiers, name: statement.name, kind: "class" }
      : isFunctionDeclaration(statement)
        ? { modifiers: statement.modifiers, name: statement.name, kind: "function" }
        : isInterfaceDeclaration(statement)
          ? { modifiers: statement.modifiers, name: statement.name, kind: "interface" }
          : isTypeAliasDeclaration(statement)
            ? { modifiers: statement.modifiers, name: statement.name, kind: "type" }
            : isEnumDeclaration(statement)
              ? { modifiers: statement.modifiers, name: statement.name, kind: "enum" }
              : undefined
  const exported = Array.some(declared?.modifiers ?? [], (modifier) => modifier.kind === SyntaxKind.ExportKeyword)
  return declared?.name !== undefined && isIdentifier(declared.name) && exported
    ? { name: declared.name, kind: declared.kind }
    : undefined
}

/** Tells assessments which other files reference each symbol the checked TypeScript file exports, as the TypeScript 7 project that includes it resolves them, so rules about single use, sole consumers, or shared ownership can be judged beyond the file itself. */
export default Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const api = yield* Effect.acquireRelease(
    Effect.sync(() => new API({ cwd: directory })),
    (api) => Effect.sync(() => api.close())
  )
  const opened = new Set<string>()
  /** The nearest tsconfig.json above a workspace file, within the workspace. */
  const nearestConfig = Effect.fnUntraced(function* (file: string) {
    const segments = String.split(file, "/")
    for (const depth of Array.range(1, segments.length)) {
      const candidate = path.join(directory, ...Array.dropRight(segments, depth), "tsconfig.json")
      if (yield* fs.exists(candidate)) {
        return Option.some(candidate)
      }
    }
    return Option.none<string>()
  })
  return Effect.gen(function* () {
    const { input } = yield* Enrichment.EnrichmentContext
    if (input._tag === "Before") {
      return "References are unavailable for a deleted file."
    }
    const file = input.change.after.path
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/iu.test(file)) {
      return ""
    }
    const config = yield* nearestConfig(file)
    if (Option.isNone(config)) {
      return `No tsconfig.json encloses ${file}, so references are unavailable.`
    }
    opened.add(config.value)
    const absolute = path.join(directory, file)
    const references = yield* Effect.sync(() => {
      const snapshot = api.updateSnapshot({ openProjects: [...opened] })
      const project = snapshot.getDefaultProjectForFile(absolute)
      const source = project?.program.getSourceFile(absolute)
      if (project === undefined || source === undefined) {
        return undefined
      }
      // Reference paths are canonical, which lower-cases them on case-insensitive file systems.
      const names = Record.fromEntries(
        Array.map(project.program.getSourceFileNames(), (name) => [String.toLowerCase(name), name] as const)
      )
      return Array.flatMap(source.statements, (statement) => {
        const declaration = exportedDeclaration(statement)
        if (declaration === undefined) {
          return []
        }
        const { name, kind } = declaration
        const counts = new Map<string, number>()
        for (const entry of project.checker.getReferencedSymbolsForNode(name, name.end - 1)) {
          for (const reference of entry.references) {
            const referencing = names[String.toLowerCase(reference.path)] ?? reference.path
            if (String.toLowerCase(referencing) !== String.toLowerCase(absolute)) {
              counts.set(referencing, (counts.get(referencing) ?? 0) + 1)
            }
          }
        }
        return [{ name: name.text, kind, counts }]
      })
    })
    if (references === undefined) {
      return `No TypeScript project includes ${file}, so references are unavailable.`
    }
    if (Array.isArrayEmpty(references)) {
      return `${file} exports no declarations.`
    }
    // A name declared as both a type and a value, such as a schema and its type alias, is listed once.
    const merged = Array.reduce(
      references,
      new Map<string, { readonly kinds: Set<string>; readonly counts: Map<string, number> }>(),
      (all, entry) => {
        const existing = all.get(entry.name) ?? { kinds: new Set<string>(), counts: new Map<string, number>() }
        existing.kinds.add(entry.kind)
        for (const [referencing, count] of entry.counts) {
          existing.counts.set(referencing, Math.max(existing.counts.get(referencing) ?? 0, count))
        }
        return all.set(entry.name, existing)
      }
    )
    const lines = Array.map([...merged], ([name, entry]) => {
      const files = pipe(
        [...entry.counts],
        Array.sort((a: readonly [string, number], b: readonly [string, number]) => (a[0] < b[0] ? -1 : 1)),
        Array.map(([referencing, count]) => `${path.relative(directory, referencing)} (${count})`)
      )
      const listed = Array.isArrayEmpty(files)
        ? "no references in other files"
        : `${Array.join(Array.take(files, filesPerSymbol), ", ")}${files.length > filesPerSymbol ? `, and ${files.length - filesPerSymbol} more files` : ""}`
      return `- ${name} (${Array.join([...entry.kinds], ", ")}): ${listed}`
    })
    return `Other files referencing the declarations ${file} exports, with reference counts:\n${Array.join(lines, "\n")}`
  })
})
