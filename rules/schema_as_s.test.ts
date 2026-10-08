import { Array } from "effect"
import { RuleTester } from "vite-plus/lint/plugins-dev"
import { describe, it } from "vite-plus/test"

import { schemaAsS } from "./schema_as_s.ts"

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } })

tester.run("schema-as-s", schemaAsS, {
  valid: [
    'import { Schema as S, Effect } from "effect"',
    'import type { Schema as S } from "effect"',
    'import { type Schema as S } from "effect"',
    'import * as S from "effect/Schema"',
    'import type * as S from "effect/Schema"',
    'import { Schema } from "other-library"',
    'import { Effect as Schema } from "effect"',
    'import * as Effect from "effect"',
    'import { String } from "effect/Schema"',
    'import "effect"'
  ],
  invalid: Array.map(
    [
      'import { Schema } from "effect"',
      'import { Schema as schema } from "effect"',
      'import { Effect, Schema as Other } from "effect"',
      'import type { Schema } from "effect"',
      'import { type Schema } from "effect"',
      'import { "Schema" as Other } from "effect"',
      'import * as Schema from "effect/Schema"',
      'import type * as Schema from "effect/Schema"'
    ],
    (code) => ({ code, errors: [{ messageId: "alias" }] })
  )
})
