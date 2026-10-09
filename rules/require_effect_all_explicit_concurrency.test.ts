import { RuleTester } from "vite-plus/lint/plugins-dev"
import { describe, it } from "vite-plus/test"

import { requireEffectAllExplicitConcurrency } from "./require_effect_all_explicit_concurrency.ts"

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } })

tester.run("require-effect-all-explicit-concurrency", requireEffectAllExplicitConcurrency, {
  valid: [
    'Effect.all(tasks, { concurrency: "unbounded" })',
    'Effect.forEach(items, f, { concurrency: "unbounded" })',
    'const options = { "concurrency": "unbounded" }',
    'Effect.all(tasks, {\n concurrency: "unbounded",\n discard: true\n})',
    "Effect.all(tasks, {\n concurrency: 4\n})",
    'const options = {\n [key]: "unbounded"\n}',
    "const options = {\n concurrency: value\n}",
    "other.all(tasks)"
  ],
  invalid: [
    { code: "Effect.all(tasks)", errors: [{ messageId: "missingExplicitConcurrency" }] },
    {
      code: 'Effect.all(tasks, {\n concurrency: "unbounded"\n})',
      errors: [{ messageId: "multilineUnboundedConcurrency" }]
    },
    {
      code: 'Effect.forEach(items, f, {\n concurrency: "unbounded"\n})',
      errors: [{ messageId: "multilineUnboundedConcurrency" }]
    },
    {
      code: 'const options = {\n "concurrency": "unbounded",\n}',
      errors: [{ messageId: "multilineUnboundedConcurrency" }]
    },
    {
      code: 'const options = { /* keep comment */\n concurrency: "unbounded" }',
      errors: [{ messageId: "multilineUnboundedConcurrency" }]
    }
  ]
})
