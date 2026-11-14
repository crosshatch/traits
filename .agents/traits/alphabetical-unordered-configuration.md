---
name: alphabetical-unordered-configuration
subject: Configuration lists and fields whose ordering has no semantic
  significance, in TypeScript, JavaScript, JSON, YAML, or TOML files. Members of
  domain types and schemas (literal or union members, struct fields, enum cases)
  are not configuration.
assertion: 'Prefer alphabetical ordering for miscellaneous configuration lists
  and fields when their order has no semantic significance: projects:
  ["oxlints/vite.config.ts", "traits.sh/vite.config.ts",
  "traits/vite.config.ts"]. Preserve intentional dependency, execution,
  precedence, and user-facing order, key order that a formatter enforces, and
  any order another trait prescribes, such as packages first in
  pnpm-workspace.yaml (see workspace-packages-first), rather than sorting those
  blindly. Alphabetical means the order of the entries as written, compared
  character by character, including leading punctuation such as ./ and @; a list
  already in that order complies.'
purpose: Make unordered configuration easy to scan and reduce incidental diff
  churn without changing execution semantics.
---

```diff
-projects: ["traits/vite.config.ts", "oxlints/vite.config.ts"]
+projects: ["oxlints/vite.config.ts", "traits/vite.config.ts"]
```

Not a violation: `"references": [{ "path": "./@traits/typescript" }, { "path": "./traits" }, { "path": "./traits.sh" }, { "path": "./tsconfig.node.json" }]`, which is already in order: `@` sorts before letters, and `./traits` before `./traits.sh`.

Not a violation: package.json keys in the conventional order the formatter enforces, such as `name`, `version`, `license` at the top level, `type`, `url`, `directory` in `repository`, and `exports`, `access` in `publishConfig`; sorting them by hand is undone on the next format. Also not a violation: a `files` list with its included patterns in order followed by its excluded (`!`) patterns in order, since an exclusion must follow what it excludes.

Out of scope: `S.Literals(["Pass", "Fail", "Inconclusive", "Incomplete"])` in Report/Verdict.ts. It defines a domain type and its published JSON Schema enum, not configuration.

Not a violation: GitHub workflow keys in their conventional reading order, such as `name`, `on`, `permissions`, `concurrency`, `jobs` at the top level, `if`, `runs-on`, `timeout-minutes`, `steps` in a job, and `name`, `id`, `uses`, `with`, `env`, `run` in a step. Steps run in the order listed. The unordered parts of a workflow, such as the events under `on`, a `types` list, and the inputs under `with`, are alphabetical.
