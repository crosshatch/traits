# traits

## 0.5.4

### Patch Changes

- [#56](https://github.com/crosshatch/traits/pull/56)
  [`8ebd418`](https://github.com/crosshatch/traits/commit/8ebd4188eb9a8d81d151df6f44d7a36348968767) -
  Expose configuration-error fallbacks as derive_trait and check_traits with
  their normal descriptions and parameters so clients surface startup failures.
  Include instructions to retry the identical trait derivation after fixing
  configuration and restarting the server.

## 0.5.3

### Patch Changes

- [#54](https://github.com/crosshatch/traits/pull/54)
  [`e9a5b1d`](https://github.com/crosshatch/traits/commit/e9a5b1d4e3b4de05f9c40ae2c806b430ca586ade) -
  Keep the MCP connection alive after configuration failures and expose an
  actionable diagnostic tool with restart instructions.

  Report stored trait parsing failures with original diagnostics and
  instructions to migrate all traits to the installed schema without stopping
  the MCP server.

## 0.5.2

### Patch Changes

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Batch independent trait assessments against shared source chunks to reduce
  decision-model requests and repeated source tokens. Bound batches by question
  count and UTF-8 size while preserving name mapping, per-trait results, and
  semaphore-limited HTTP concurrency. Fail oversized inputs and incomplete
  provider answers explicitly instead of truncating or silently skipping checks.

- [#30](https://github.com/crosshatch/traits/pull/30)
  [`e624bdc`](https://github.com/crosshatch/traits/commit/e624bdcfe77a7eb265a0627f9b9d8e409daca1be) -
  Allow configuring decision model concurrency with an optional
  decisionConcurrency setting that defaults to 4. Apply configuration defaults
  during schema decoding.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Construct complete trait records directly with their schema constructor and
  explicit unique names, without an identifier-generating wrapper.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Define intrinsic error messages on their error types instead of repeating them
  at construction sites. Messages are class overrides, not constructor fields.
  Tool response schemas retain encoded messages and structured diagnostic
  fields.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Extract generic schema-driven YAML envelope parsing and serialization into
  _util/Frontmatter. Parsing requires `{ text, path }` and preserves schema
  decoding services. Trait.parse now requires a diagnostic path; document errors
  use generic MissingFrontmatterError, UnterminatedFrontmatterError, and
  InvalidYamlError tags.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Use descriptive kebab-case names without redundant trait- prefixes for trait
  frontmatter and name-only filenames. Update naming validation, model guidance,
  examples, and migration instructions. Migrate the repository's saved names and
  name-based ignores while preserving trait bodies.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Use a provider-compatible structured response for reconciliation extension
  metadata and retain omitted metadata when replacing a single original trait.
  Keep coverage checks focused and explicitly opt-in, using the real decision
  model instead of predetermined model-answer mocks without broad end-to-end
  workflow coverage.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Match file-scoped trait ignore directives by exact unique trait name. Use a
  name-based exception in the CLI launcher and document rename behavior and
  migration guidance.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Simplify assessment result construction by removing per-result Effects and
  spans. Keep batch-level tracing, assessment output, request limits, and
  concurrency unchanged. Remove the unused single-trait evaluate helper; use
  evaluateAll with a one-element array.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Replace generic trait parsing and synthetic storage failures with
  situation-specific tagged errors carrying actionable file, trait name, and
  YAML position context. Add contextual assessment-size and Git-listing
  failures, preserve native operational and validation errors, and expose
  concrete failure schemas through both MCP tools. Return declared failures as
  encoded MCP errors so context is not reduced to message text, while keeping
  provider request metadata private.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Support YAML frontmatter in traits, exposing when, MIME, and skip metadata
  with unique descriptive kebab-case names as identities. Use name-only Markdown
  filenames in the filesystem adapter; the storage service uses names
  independently of its backend and preserves full trait metadata.

  Independently verify full coverage against saved bodies and applicability
  metadata before returning Covered. Route coverage gaps through approval-gated
  reconciliation and preserve metadata in generated replacements.

- [#33](https://github.com/crosshatch/traits/pull/33)
  [`6cf5efb`](https://github.com/crosshatch/traits/commit/6cf5efbe46ba29dfa95e59009e334ef0d1124134) -
  Declare stored, frontmatter, and generated trait schemas from shared field
  definitions using Effect VariantSchema. Use the named generated schema for
  reconciliation instead of deriving field subsets inside the tool flow.

- [#53](https://github.com/crosshatch/traits/pull/53)
  [`7f57812`](https://github.com/crosshatch/traits/commit/7f57812449b0a0e8ad2d102687fe0a363264a009) -
  Store optional BAD-to-GOOD diff examples separately from trait bodies,
  serialize them as fenced diffs after frontmatter, and include them in trait
  derivation and approval.

- [#52](https://github.com/crosshatch/traits/pull/52)
  [`0ccdabb`](https://github.com/crosshatch/traits/commit/0ccdabb7cae2df20f5b92db66ce0a1424a1f8230) -
  Use unique trait names as canonical identity instead of UUIDs. Store traits as
  `<name>.md` without an `id` frontmatter field, select focused reviews with
  `traitNames`, and match ignore directives by exact name. Reject duplicate
  names and protect unaffected traits during reconciliation. See
  MIGRATE_TRAITS.md for migrating existing collections and references.

## 0.5.1

### Patch Changes

- [#22](https://github.com/crosshatch/traits/pull/22)
  [`efd68c2`](https://github.com/crosshatch/traits/commit/efd68c29c9b67a5a7f331980f5fcc66f5c54f1d7) -
  Install checkout dependencies before starting the CLI and support targeted
  `traits-ignore-file` exceptions during file reviews.

- [#17](https://github.com/crosshatch/traits/pull/17)
  [`e331b3a`](https://github.com/crosshatch/traits/commit/e331b3abe41eb3bf6077f6f3d0b7cace2dc34290) -
  Remove the init command in favor of agent-guided setup. The setup prompt
  points to a canonical guide covering consumer-specific package-manager
  configuration, provider selection, agent-specific skill placement, and MCP
  connection.

## 0.5.0

### Minor Changes

- [#11](https://github.com/crosshatch/traits/pull/11)
  [`3af6084`](https://github.com/crosshatch/traits/commit/3af60845210600bc9ea31c7d9a40b6305c4c84f7) -
  Initial release of the Traits MCP server, SDK, and init CLI.

### Patch Changes

- [#13](https://github.com/crosshatch/traits/pull/13)
  [`3516acd`](https://github.com/crosshatch/traits/commit/3516acdec2be9be9d0cccd8cd53c976fc90abc1d) -
  Exclude Git-ignored files by default, refreshing ignore rules on each check.
  Untracked files do not need to be added to Git to be evaluated.
  Already-tracked files remain eligible even if ignore rules match them. Set
  excludeGitignored: false to opt out.

- [#13](https://github.com/crosshatch/traits/pull/13)
  [`3516acd`](https://github.com/crosshatch/traits/commit/3516acdec2be9be9d0cccd8cd53c976fc90abc1d) -
  Keep init focused on creating configuration and print explicit skill
  installation instructions for native pnpm support and cross-agent installers.
  Stop copying a potentially stale skill snapshot automatically; existing files
  remain untouched.
