import { definePlugin } from "vite-plus/lint/plugins"

import { noPackageSelfImport } from "./no_package_self_import.ts"
import { requireEffectAllExplicitConcurrency } from "./require_effect_all_explicit_concurrency.ts"
import { requireReadonlyTypeMembers } from "./require_readonly_type_members.ts"
import { schemaAsS } from "./schema_as_s.ts"

export default definePlugin({
  meta: { name: "custom" },
  rules: {
    "no-package-self-import": noPackageSelfImport,
    "require-effect-all-explicit-concurrency": requireEffectAllExplicitConcurrency,
    "require-readonly-type-members": requireReadonlyTypeMembers,
    "schema-as-s": schemaAsS
  }
})
