import { defineRule } from "vite-plus/lint/plugins"

export const schemaAsS = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Require Effect Schema imports to use the alias S." },
    messages: { alias: "Import Effect Schema as S." },
    schema: []
  },
  create: (context) => ({
    ImportDeclaration: (node) => {
      for (const specifier of node.specifiers) {
        const isSchema =
          node.source.value === "effect"
            ? specifier.type === "ImportSpecifier" &&
              (specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value) ===
                "Schema"
            : node.source.value === "effect/Schema" && specifier.type === "ImportNamespaceSpecifier"
        if (isSchema && specifier.local.name !== "S") {
          context.report({ node: specifier, messageId: "alias" })
        }
      }
    }
  })
})
