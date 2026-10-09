import Fs from "node:fs"
import Path from "node:path"
import { fileURLToPath } from "node:url"

import { MutableHashMap, Option, pipe, Schema as S, String } from "effect"
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins"

type PackageInfo = {
  readonly directory: string
  readonly name: string
}

const packageInfoByDirectory = MutableHashMap.empty<string, PackageInfo | null>()

const decodePackageName = S.Struct({ name: S.String }).pipe(S.fromJsonString, S.decodeUnknownOption)

const normalizePath = (value: string) => (pipe(value, String.startsWith("file://")) ? fileURLToPath(value) : value)

const findPackageInfo = (context: Context): PackageInfo | null => {
  const cwd = normalizePath(context.cwd)
  let directory = Path.dirname(normalizePath(context.filename))
  const { root } = Path.parse(cwd)

  while (directory !== root) {
    const cached = pipe(MutableHashMap.get(packageInfoByDirectory, directory), Option.getOrUndefined)

    if (cached !== undefined && cached !== null) return cached
    const packageJsonPath = Path.join(directory, "package.json")

    if (Fs.existsSync(packageJsonPath)) {
      const packageJson = pipe(decodePackageName(Fs.readFileSync(packageJsonPath, "utf8")), Option.getOrUndefined)
      const packageInfo = packageJson !== undefined ? { directory, name: packageJson.name } : null
      MutableHashMap.set(packageInfoByDirectory, directory, packageInfo)

      if (packageInfo !== null) return packageInfo
    } else {
      MutableHashMap.set(packageInfoByDirectory, directory, null)
    }

    if (directory === cwd) return null
    directory = Path.dirname(directory)
  }

  return null
}

export const noPackageSelfImport: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing a package by name from within that same package."
    },
    messages: {
      packageSelfImport: "Do not import '{{ packageName }}' from within itself. Use relative imports instead."
    },
    schema: []
  },
  create: (context) => {
    const packageInfo = findPackageInfo(context)

    if (packageInfo === null) return {}

    const checkSource = (source: ESTree.StringLiteral | null) => {
      if (source === null) return

      if (source.value !== packageInfo.name && !pipe(source.value, String.startsWith(`${packageInfo.name}/`))) return

      context.report({
        node: source,
        messageId: "packageSelfImport",
        data: { packageName: packageInfo.name }
      })
    }

    return {
      ExportAllDeclaration: (node) => checkSource(node.source),
      ExportNamedDeclaration: (node) => checkSource(node.source),
      ImportDeclaration: (node) => checkSource(node.source)
    }
  }
}
