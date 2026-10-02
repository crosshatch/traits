import Fs from "node:fs"
import Path from "node:path"
import { fileURLToPath } from "node:url"

import { Option, Schema } from "effect"
import type { Context, ESTree, Rule } from "vite-plus/lint/plugins"

type PackageInfo = {
  readonly directory: string
  readonly name: string
}

const packageInfoByDirectory = new Map<string, PackageInfo | null>()

const decodePackageName = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Struct({ name: Schema.String })))

const normalizePath = (value: string) => (value.startsWith("file://") ? fileURLToPath(value) : value)

const findPackageInfo = (context: Context): PackageInfo | null => {
  const cwd = normalizePath(context.cwd)
  let directory = Path.dirname(normalizePath(context.filename))
  const { root } = Path.parse(cwd)

  while (directory !== root) {
    const cached = packageInfoByDirectory.get(directory)

    if (cached !== undefined && cached !== null) return cached
    const packageJsonPath = Path.join(directory, "package.json")

    if (Fs.existsSync(packageJsonPath)) {
      const packageJson = decodePackageName(Fs.readFileSync(packageJsonPath, "utf8"))
      const packageInfo = Option.isSome(packageJson) ? { directory, name: packageJson.value.name } : null
      packageInfoByDirectory.set(directory, packageInfo)

      if (packageInfo !== null) return packageInfo
    } else {
      packageInfoByDirectory.set(directory, null)
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

      if (source.value !== packageInfo.name && !source.value.startsWith(`${packageInfo.name}/`)) return

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
