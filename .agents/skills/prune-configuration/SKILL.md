---
name: prune-configuration
description: Audit and simplify configuration, scripts, and supporting files by removing redundancy and unnecessary complexity.
---

# Prune Configuration

Keep configuration concise and deliberate. Every setting, script, and file should
serve a current requirement. Prefer verified defaults over explicit repetition.

## Workflow

1. Read applicable project instructions and inspect the working tree. Preserve
   unrelated changes; treat vendored repositories as read-only references.
2. Trace config inheritance, references, scripts, working directories, environment
   variables, and CLI overrides before editing.
3. Ask: **What changes if this is removed, and do we need that difference?**
   Verify defaults against the installed tool version.
4. Remove duplication and unnecessary indirection. Update consumers and docs
   when renaming or deleting files.
5. Run proportionate checks and report what changed and what was verified.

## Audit Targets

- **TypeScript:** redundant flags, exclusions that never match includes,
  unnecessary `rootDir`, duplicate ambient types, and overlapping projects.
  Account for inherited path resolution, replaced file lists, and composite
  projects' requirements for imported files. `exclude` does not block imports.
- **Package scripts:** duplicate aliases or lifecycle commands, unnecessary
  `--config` flags, and wrappers around package-manager behavior.
- **Test/build configs:** speculative project splits, custom plugins, guards,
  and helpers where defaults or existing libraries suffice.
- **Dependencies:** unused declarations and obsolete compatibility settings.
  Check peer requirements; regenerate lockfiles through the package manager.
- **Documentation:** stale paths, commands, and explanations of complexity that
  should instead be removed.

## Guardrails

- Preserve intended behavior, runtime compatibility, and meaningful boundaries
  such as library emission versus test checking.
- Follow comparable upstream examples, not internal monorepo machinery.
- Do not add placeholders or relax empty-suite failures just to get green checks.
- Validate affected type-checks, builds, discovery, or packed artifacts. Use a
  fresh TypeScript check when caches could hide changes.
- Do not deploy or publish for an audit unless requested. Report blockers and
  skipped checks accurately.
