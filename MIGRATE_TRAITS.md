# Migrate Traits

One-time instructions for migrating older Traits collections. This is not an
automatic package-upgrade step or a packaged agent skill. Give your agent:

> Follow MIGRATE_TRAITS.md to migrate this project's existing collection.
> Preserve bodies and metadata, and show me the migration plan before changing
> files.

## Target format

Each trait has a unique descriptive kebab-case name as its canonical identity.
Store it in `.agents/traits/<name>.md` with `name` in leading YAML frontmatter.
There is no separate `id` field or identifier suffix in the filename.

For example, an older file named
`prefer-arrow-functions-2535ceab-5702-4ab4-932a-f87362adf8c6.md` becomes
`prefer-arrow-functions.md`:

```markdown
---
name: prefer-arrow-functions
---

Prefer arrow functions for ordinary functions.
```

Names must match `^(?!trait-)[a-z0-9]+(?:-[a-z0-9]+)*$`, be at most 80
characters, and describe the trait. Names must be unique across the collection.
Renaming changes identity; update references too.

## 1. Establish scope and protect existing work

- Read project instructions, inspect Git status, and confirm the worktree,
  configured MCP working directory, installed Traits version, and package
  manager. Default to this project's `.agents/traits`; ask before touching other
  collections. Do not follow symlinks outside the agreed scope or discard
  existing work.
- Verify the installed SDK supports name-only records and `traitNames`
  selections. Follow the [setup guide] for any needed package update, respecting
  consumer dependency policies. Do not change providers, credentials, or models.
- Pause trait writes and disconnect the Traits server during migration. Do not
  run checks against a mixed-format collection. Leave unrelated MCP servers
  alone.
- Back up originals and reference-bearing files privately outside
  `.agents/traits` and version control. Backup Markdown inside the collection
  would be read as traits.

## 2. Inventory and approve the plan

Read each file directly. Record its old path, filename stem, legacy ID if any,
descriptive name, original body, metadata, and target path. Build an explicit
mapping from old IDs, names, and paths to the new unique names and paths.

- Preserve existing valid descriptive names. For legacy random-word filenames,
  read the body and propose an appropriate descriptive name instead.
- Convert older snake_case names to kebab-case and remove redundant leading
  `trait-` prefixes. Leave already valid name-only records unchanged.
- Flag duplicate names, target collisions, conflicting legacy identities,
  malformed frontmatter, ambiguous delimiters, or unsupported metadata. Ask how
  to resolve them; do not overwrite, silently merge, or delete traits.
- Show the complete rename/reference mapping and unresolved cases. Obtain
  approval before changing files. Do not unnecessarily expose private trait
  bodies.

## 3. Migrate without changing preferences

Use a YAML parser/serializer and installed Traits schemas where available. Do
not substitute text across arbitrary YAML or add a runtime schema dependency
solely for the migration.

- Remove the legacy frontmatter `id` and filename identifier suffix. Set `name`
  to the approved unique name and use exactly `<name>.md` as the filename.
- Preserve the Markdown body exactly, including whitespace and line endings. Do
  not summarize, split, merge, reconcile, or derive replacement preferences.
- Preserve all other valid JSON-compatible metadata and extension fields. `when`
  and `skip` are optional strings; `mime` is a string or array of strings. Flag
  unsupported values rather than coercing or dropping them.
- If legacy `activation` exists, migrate it to `when`. Remove only a redundant
  leading "When " (case insensitive). Compare normalized values if both fields
  exist and ask before resolving disagreements. Do not change bodies or `skip`.
- Do not invent applicability metadata: `when` defines positive scope, `mime`
  restricts file types, and `skip` is only an independent exception in that
  scope.
- Construct complete records with
  `Trait.Trait.make({ name, body, ...metadata })` and serialize them. Do not
  generate identifiers or call `derive_trait`.
- Verify replacements against the inventory before removing old files. Never
  overwrite an unrelated destination. Retain the external backup for recovery.

## 4. Update active references

Search project-owned source, documentation, agent instructions, and
configuration. Exclude secrets, dependencies, generated output, lockfiles, Git
metadata, and backups. Do not rewrite Git history or unrelated identifiers.

- Change links to `.agents/traits/<name>.md`.
- Replace `check_traits({ traitIds: [...] })` with
  `check_traits({ traitNames: [...] })`, mapping legacy IDs to exact unique
  names.
- Map old ID/full-stem ignore directives to unique names while preserving their
  reasons and leading-header locations:

  ```ts
  // traits-ignore-file prefer-arrow-functions: Required by this integration.
  ```

- Preserve exact-name directives when the name is unchanged; update them after
  renaming. Partial names and filenames are not selectors. Ask about unknown or
  ambiguous references rather than guessing.
- Update SDK consumers to complete name-only records. `add(trait)` rejects
  duplicate names, `get(name)` and `rm(names)` select names, and `update(trait)`
  replaces the record at `trait.name`. To rename, add the new record before
  removing the old name; do not use update to rename or overwrite an existing
  trait.

## 5. Validate and reconnect

Parse every record with the new schema. Verify unique names,
filename/frontmatter agreement, no legacy `id` fields, and exact preservation of
bodies and other metadata against the inventory. Confirm record counts and all
active references. A repeated migration should make no changes.

Review the diff and report changed paths, reference updates, and blockers. A
partial migration is not success: keep the server paused and use the inventory
and backup to recover only migration changes if needed.

Refresh the installed `traits` skill without overwriting customizations, then
reconnect the Traits MCP server to load the updated package and instructions.
Verify tool availability and, when credentials allow, run a small `check_traits`
smoke check on project-owned source. Review changed TypeScript against all
traits, fix confirmed violations, and run relevant formatting, type, and
behavior checks. Missing credentials or model failures are incomplete
verification, not a pass.

[setup guide]: https://github.com/crosshatch/traits/blob/main/SETUP.md
