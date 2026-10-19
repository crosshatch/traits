---
name: prefer-patch-changesets
subject: Changesets and release increment selection.
requirement: Prefer patch changesets by default. Use a minor changeset only when
  there is a compelling reason for a minor release.
applicability: |-
  Applies when authoring changesets or choosing a release increment.
  File types or languages: text/markdown.
---
```diff
 ---
-"traits": minor
+"traits": patch
 ---
```
