import { Array, Effect, FileSystem, flow, Option, Path, pipe, Record, Schema as S, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { Enrichment } from "traits"
import { WorkspaceRoot } from "traits/local"
import { type Identifier, type Statement, SyntaxKind } from "typescript/unstable/ast"
import {
  isClassDeclaration,
  isEnumDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isStringLiteral,
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

/** Per referencing file, how often it uses a declaration and how often it re-exports it by name. */
interface Referencing {
  readonly uses: Map<string, number>
  readonly reexports: Set<string>
}

/** Tells assessments which other files use each declaration the checked TypeScript file exports, and which re-export it, across every TypeScript project in the workspace, so rules about single use, sole consumers, or shared ownership can be judged beyond the file itself. */
export default Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const { directory } = yield* WorkspaceRoot
  /** Workspace files with the given name that Git tracks or would track, relative to the workspace root. */
  const gitFiles = (fileName: string) =>
    spawner
      .spawn(
        ChildProcess.make("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", `*${fileName}`], {
          cwd: directory,
          stdin: "ignore",
          stderr: "ignore"
        })
      )
      .pipe(
        Effect.flatMap((handle) => handle.stdout.pipe(Stream.decodeText(), Stream.mkString)),
        Effect.map(
          flow(
            String.split("\n"),
            Array.filter((file) => file === fileName || pipe(file, String.endsWith(`/${fileName}`)))
          )
        ),
        Effect.scoped,
        Effect.orElseSucceed((): ReadonlyArray<string> => [])
      )
  // Every project is opened, so uses from other packages in the workspace are counted too.
  const configs = yield* gitFiles("tsconfig.json")
  // Package entry points, by lower-cased absolute path, so re-export chains that reach one can be reported as public API.
  const entries = new Map<string, string>()
  for (const manifest of yield* gitFiles("package.json")) {
    const parsed = yield* fs.readFileString(path.join(directory, manifest)).pipe(
      Effect.flatMap(
        S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              name: S.String.pipe(S.optionalKey),
              exports: S.Unknown.pipe(S.optionalKey),
              main: S.String.pipe(S.optionalKey)
            })
          )
        )
      ),
      Effect.option
    )
    if (Option.isNone(parsed) || parsed.value.name === undefined) {
      continue
    }
    const targets: Array<string> = []
    const collect = (value: unknown): void => {
      if (typeof value === "string") {
        targets.push(value)
      } else if (typeof value === "object" && value !== null) {
        Array.forEach(Record.values(value as Record.ReadonlyRecord<string, unknown>), collect)
      }
    }
    collect([parsed.value.exports, parsed.value.main])
    for (const target of targets) {
      entries.set(String.toLowerCase(path.resolve(directory, path.dirname(manifest), target)), parsed.value.name)
    }
  }
  const api = yield* Effect.sync(() => new API({ cwd: directory })).pipe((acquire) =>
    Effect.acquireRelease(acquire, (api) => Effect.sync(() => api.close()))
  )
  const opened = new Set(Array.map(configs, (config) => path.join(directory, config)))
  let snapshot = yield* Effect.sync(() => api.updateSnapshot({ openProjects: [...opened] }))
  // Re-exports by target file: wildcard ones (export * from, export * as X from) produce no references, and all of them are followed to find package entry points.
  const { wildcards, reexporters } = yield* Effect.sync(() => {
    const wildcards = new Map<string, Set<string>>()
    const reexporters = new Map<string, Set<string>>()
    for (const project of snapshot.getProjects()) {
      for (const name of project.program.getSourceFileNames()) {
        if (pipe(name, String.includes("/node_modules/")) || pipe(name, String.endsWith(".d.ts"))) {
          continue
        }
        for (const statement of project.program.getSourceFile(name)?.statements ?? []) {
          if (
            !isExportDeclaration(statement) ||
            statement.moduleSpecifier === undefined ||
            !isStringLiteral(statement.moduleSpecifier)
          ) {
            continue
          }
          const target = String.toLowerCase(path.resolve(path.dirname(name), statement.moduleSpecifier.text))
          reexporters.set(target, (reexporters.get(target) ?? new Set<string>()).add(name))
          if (statement.exportClause === undefined || statement.exportClause.kind === SyntaxKind.NamespaceExport) {
            wildcards.set(target, (wildcards.get(target) ?? new Set<string>()).add(name))
          }
        }
      }
    }
    return { wildcards, reexporters }
  })
  /** The package entry point a module's exports reach by following re-exports, if any. */
  const publicEntry = (from: Iterable<string>) => {
    const seen = new Set<string>()
    const queue = [...from]
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const key = String.toLowerCase(next)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      const name = entries.get(key)
      if (name !== undefined) {
        return { name, file: next }
      }
      queue.push(...(reexporters.get(key) ?? []))
    }
    return undefined
  }
  /** The nearest tsconfig.json above a workspace file, for files no listed project includes, such as outside Git. */
  const nearestConfig = Effect.fnUntraced(function* (file: string) {
    const segments = String.split(file, "/")
    for (const depth of Array.range(1, segments.length)) {
      const candidate = path.join(directory, ...Array.dropRight(segments, depth), "tsconfig.json")
      if (yield* fs.exists(candidate)) {
        return candidate
      }
    }
    return undefined
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
    const absolute = path.join(directory, file)
    const included = Array.some(
      snapshot.getProjects(),
      (project) => project.program.getSourceFile(absolute) !== undefined
    )
    const fallback = included ? undefined : yield* nearestConfig(file)
    if (fallback !== undefined && !opened.has(fallback)) {
      opened.add(fallback)
      snapshot = yield* Effect.sync(() => api.updateSnapshot({ openProjects: [...opened] }))
    }
    const declarations = yield* Effect.sync(() => {
      const projects = Array.filter(
        snapshot.getProjects(),
        (project) => project.program.getSourceFile(absolute) !== undefined
      )
      const merged = new Map<string, { readonly kinds: Set<string>; readonly referencing: Referencing }>()
      for (const project of projects) {
        // Reference paths are canonical, which lower-cases them on case-insensitive file systems.
        const names = Record.fromEntries(
          Array.map(project.program.getSourceFileNames(), (name) => [String.toLowerCase(name), name] as const)
        )
        for (const statement of project.program.getSourceFile(absolute)!.statements) {
          const declaration = exportedDeclaration(statement)
          if (declaration === undefined) {
            continue
          }
          // A name declared as both a type and a value, such as a schema and its type alias, is listed once.
          const entry = merged.get(declaration.name.text) ?? {
            kinds: new Set<string>(),
            referencing: { uses: new Map<string, number>(), reexports: new Set<string>() }
          }
          entry.kinds.add(declaration.kind)
          const uses = new Map<string, number>()
          for (const referenced of project.checker.getReferencedSymbolsForNode(
            declaration.name,
            declaration.name.end - 1
          )) {
            for (const reference of referenced.references) {
              const referencing = names[String.toLowerCase(reference.path)] ?? reference.path
              if (String.toLowerCase(referencing) === String.toLowerCase(absolute)) {
                continue
              }
              const parent = reference.resolve(project)?.parent.kind
              if (parent === SyntaxKind.ExportSpecifier) {
                entry.referencing.reexports.add(referencing)
              } else if (parent !== SyntaxKind.ImportSpecifier && parent !== SyntaxKind.ImportClause) {
                // Imports bring a declaration into scope; only the sites that then use it are counted.
                uses.set(referencing, (uses.get(referencing) ?? 0) + 1)
              }
            }
          }
          // Projects can share files, so a file's count is the most any one project reports, not their sum.
          for (const [referencing, count] of uses) {
            entry.referencing.uses.set(referencing, Math.max(entry.referencing.uses.get(referencing) ?? 0, count))
          }
          merged.set(declaration.name.text, entry)
        }
      }
      for (const entry of merged.values()) {
        for (const barrel of wildcards.get(String.toLowerCase(absolute)) ?? []) {
          entry.referencing.reexports.add(barrel)
        }
      }
      return Array.isArrayEmpty(projects) ? undefined : merged
    })
    if (declarations === undefined) {
      return `No TypeScript project includes ${file}, so references are unavailable.`
    }
    if (declarations.size === 0) {
      return `${file} exports no declarations.`
    }
    const relative = (absolutePath: string) => path.relative(directory, absolutePath)
    const lines = Array.map([...declarations], ([name, entry]) => {
      const uses = pipe(
        [...entry.referencing.uses],
        Array.sort((a: readonly [string, number], b: readonly [string, number]) => (a[0] < b[0] ? -1 : 1)),
        Array.map(([referencing, count]) => `${relative(referencing)} (${count})`)
      )
      const used = Array.isArrayEmpty(uses)
        ? "no uses in other files"
        : `used by ${Array.join(Array.take(uses, filesPerSymbol), ", ")}${uses.length > filesPerSymbol ? `, and ${uses.length - filesPerSymbol} more files` : ""}`
      const reexported = Array.isArrayEmpty([...entry.referencing.reexports])
        ? ""
        : `; re-exported by ${Array.join(Array.map([...entry.referencing.reexports].sort(), relative), ", ")}`
      const reached = publicEntry([absolute, ...entry.referencing.reexports])
      const exposed =
        reached === undefined ? "" : `; public API of package ${reached.name} through ${relative(reached.file)}`
      return `- ${name} (${Array.join([...entry.kinds], ", ")}): ${used}${reexported}${exposed}`
    })
    return `Uses of the declarations ${file} exports in other files of the workspace, with counts. Re-exports, including wildcard export * re-exports, are listed separately and are not uses. Public API marks a declaration that a package entry point exports, directly or through a chain of re-exporting modules.\n${Array.join(lines, "\n")}`
  })
})
