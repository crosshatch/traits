import { Option, pipe, String } from "effect"
import { type Context, defineRule, type ESTree } from "vite-plus/lint/plugins"

const reportMissingReadonly = (context: Context, node: ESTree.TSIndexSignature | ESTree.TSPropertySignature) => {
  if (node.readonly) return
  context.report({
    node,
    messageId: "missingReadonly",
    fix: (fixer) => fixer.insertTextBeforeRange([node.range[0], node.range[0]], "readonly ")
  })
}

const reportMissingMappedReadonly = (context: Context, node: ESTree.TSMappedType) => {
  if (node.readonly === true || node.readonly === "+") return
  context.report({
    node,
    messageId: "missingReadonly",
    fix: (fixer) => {
      const source = pipe(context.sourceCode.getText(), String.slice(node.range[0]))
      if (node.readonly === "-") {
        const modifierStart = pipe(
          source,
          String.indexOf("-readonly"),
          Option.map((index) => index + node.range[0]),
          Option.getOrUndefined
        )

        if (modifierStart !== undefined && modifierStart < node.key.range[0]) {
          return fixer.replaceTextRange([modifierStart, modifierStart + "-readonly".length], "readonly")
        }
      }

      const braceIndex = pipe(
        source,
        String.indexOf("{"),
        Option.map((index) => index + node.range[0]),
        Option.getOrUndefined
      )

      if (braceIndex !== undefined && braceIndex < node.key.range[0]) {
        return fixer.insertTextAfterRange([braceIndex, braceIndex + 1], " readonly")
      }

      return null
    }
  })
}

export const requireReadonlyTypeMembers = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require object type and interface members to be readonly."
    },
    fixable: "code",
    messages: {
      missingReadonly: "Object type and interface members must be marked readonly."
    },
    schema: []
  },
  create: (context) => ({
    TSIndexSignature: (node) => reportMissingReadonly(context, node),
    TSMappedType: (node) => reportMissingMappedReadonly(context, node),
    TSPropertySignature: (node) => reportMissingReadonly(context, node)
  })
})
