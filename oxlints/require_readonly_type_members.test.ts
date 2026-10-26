import { RuleTester } from "vite-plus/lint/plugins-dev"
import { describe, it } from "vite-plus/test"

import { requireReadonlyTypeMembers } from "./require_readonly_type_members.ts"

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } })

tester.run("require-readonly-type-members", requireReadonlyTypeMembers, {
  valid: ["type ReadonlyMap<T> = { readonly [K in keyof T]: T[K] }"],
  invalid: [
    {
      code: "type First = {}; type Second<T> = { [K in keyof T]: T[K] }",
      output: "type First = {}; type Second<T> = { readonly [K in keyof T]: T[K] }",
      errors: [{ messageId: "missingReadonly" }]
    },
    {
      code: 'const earlier = "-readonly"; type Mutable<T> = { -readonly [K in keyof T]: T[K] }',
      output: 'const earlier = "-readonly"; type Mutable<T> = { readonly [K in keyof T]: T[K] }',
      errors: [{ messageId: "missingReadonly" }]
    }
  ]
})
