---
"traits": patch
---

Apply `TraitsConfig.excludes` and the built-in Git metadata and nested worktree
exclusions to `check_traits` by resolving them against the `traits.ts`
directory, matching the absolute include patterns they filter.
