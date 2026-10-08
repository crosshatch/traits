import { defineRule } from "vite-plus/lint/plugins"

export const requireEffectAllExplicitConcurrency = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require explicit Effect.all options and single-line unbounded-concurrency objects."
    },
    messages: {
      missingExplicitConcurrency: "Effect.all must specify its optional second argument.",
      multilineUnboundedConcurrency: 'Keep { concurrency: "unbounded" } on one line.'
    },
    schema: []
  },
  create: (context) => ({
    ObjectExpression: (node) => {
      if (node.properties.length !== 1) return
      const property = node.properties[0]
      if (
        property?.type !== "Property" ||
        property.computed ||
        property.kind !== "init" ||
        property.method ||
        (property.key.type === "Identifier"
          ? property.key.name
          : property.key.type === "Literal"
            ? property.key.value
            : undefined) !== "concurrency" ||
        property.value.type !== "Literal" ||
        property.value.value !== "unbounded"
      )
        return
      if (!/[\r\n]/.test(context.sourceCode.getText(node))) return
      context.report({ node, messageId: "multilineUnboundedConcurrency" })
    },
    CallExpression: (node) => {
      if (
        node.callee.type !== "MemberExpression" ||
        node.callee.computed ||
        node.callee.object.type !== "Identifier" ||
        node.callee.object.name !== "Effect" ||
        node.callee.property.type !== "Identifier" ||
        node.callee.property.name !== "all"
      ) {
        return
      }

      if (node.arguments.length >= 2) return

      context.report({ node, messageId: "missingExplicitConcurrency" })
    }
  })
})
