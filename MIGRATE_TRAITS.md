# Migrate Traits

This is a one-time, explicit migration guide, not an automatic package-upgrade
step. Old-format traits fail with `TraitParseError` and actionable guidance. No
files are rewritten by a failed read or check.

## Target format

Each `.agents/traits/<name>.md` contains fixed YAML frontmatter and optional
Markdown context:

```markdown
---
name: prefer-arrow-functions
subject: Ordinary function declarations.
requirement: Prefer arrow functions for ordinary functions.
applicability: Except Effect generator functions.
purpose: Keep ordinary function syntax consistent.
guidance: Replace ordinary function declarations with arrow functions.
---

Optional examples, references, and additional context.
```

Only `name`, `subject`, and `requirement` are required. Optional frontmatter
fields are `applicability`, `purpose`, and `guidance`, all natural-language
strings. Supporting `context` is the Markdown body, never a frontmatter key.
Unknown keys are rejected. Use multiline YAML literal blocks for multiline text.

Names remain unique descriptive kebab-case identities, at most 80 characters,
matching `^(?!trait-)[a-z0-9]+(?:-[a-z0-9]+)*$`. Preserve existing valid names
and filenames. Renaming changes identity and requires updating references.

## 1. Establish scope and preserve originals

- Read project instructions and inspect Git status. Confirm the collection,
  installed package, and MCP working directory. Default to `.agents/traits`.
- Do not discard unrelated work, follow symlinks outside the agreed scope, or
  change providers, credentials, or models.
- Pause trait writes and checks while the collection contains mixed formats.
- Keep a private backup and inventory outside the collection and version
  control. Backup Markdown inside the collection would itself be read as traits.
- Inventory each original identity, requirement body, applicability, diff
  example, and additional metadata. Identify collisions and ambiguous content.
  Obtain approval of the migration scope and any semantic changes before
  editing.

## 2. Convert content explicitly

Use a YAML parser and the installed SDK, not substitutions across arbitrary
YAML.

- Preserve `name` and its matching filename. For older IDs or invalid names,
  propose explicit identity/reference mappings before changing them.
- Identify the subject described by the original trait and write it as
  `subject`. Do not invent a narrower or broader scope.
- Move the original authoritative body into `requirement`, preserving intent,
  requirements, and exceptions. Separate supporting examples or explanation into
  context only when that does not hide essential obligations.
- Convert old `when`/`activation`, `mime`, and `skip` fields into
  natural-language `applicability`, retaining every language restriction and
  independent exception. Omit applicability if there is no restriction beyond
  the subject.
- Move old `diff` examples into fenced Markdown diffs in context. For older
  formats with a leading fenced example and separator, preserve the example as
  context and the standalone rule as requirement.
- Review all extension metadata individually. Preserve meaningful domain facts
  as readable context. Flag unsupported or ambiguous values; do not silently
  discard them or carry them into arbitrary new frontmatter keys.
- Add `purpose` and `guidance` only when supported by existing content. Do not
  manufacture rationale or action instructions just to fill optional fields.
- Construct complete records with `Trait.Trait.make` and serialize with
  `Trait.serialize`. Do not call `derive_trait` to migrate unchanged
  preferences.

Do not keep old `body`, `diff`, `when`, `mime`, `skip`, or extension metadata
keys in the target frontmatter. Requirement is authoritative; purpose explains
intent, guidance advises without granting permissions, and context supports
interpretation.

## 3. Update consumers and references

- `derive_trait` now accepts `{ proposedTrait, approved? }`, where
  `proposedTrait` is the complete trait object, not a string. Name,
  applicability, and examples are no longer separate tool parameters.
- Domain records contain `name`, `subject`, `requirement`, optional text
  `applicability`, `purpose`, `guidance`, and optional Markdown `context`.
- Storage still accepts complete records and selects by name. Clarifications
  replace the complete record while retaining its existing name; omitted
  optional fields are removed.
- Update links, focused `traitNames` selections, and leading-header ignore
  directives only when names change. Preserve directive reasons.
- Refresh skill instructions without overwriting local customizations. Reconnect
  the MCP server after changing the installed package so its tool contracts
  match.

## 4. Verify

Parse and roundtrip every migrated record with the new SDK. Compare
requirements, scope, exceptions, context, and examples against the inventory.
Verify unchanged record counts, unique names, filename agreement, and active
references. A repeat migration should do nothing to already-current records.

Review changes before resuming writes. Run relevant formatting, type, build, and
behavior checks for consumer changes. Use real-model checks for material
semantic changes when credentials permit, and distinguish those results from
deterministic parser and protocol tests. Missing credentials or model failures
are incomplete verification, not passes. See [SETUP.md](SETUP.md) for
configuration.
