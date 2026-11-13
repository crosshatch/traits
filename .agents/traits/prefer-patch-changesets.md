---
name: prefer-patch-changesets
subject: Changesets and release increment selection. Applies when authoring
  changesets or choosing a release increment. In Markdown files.
assertion: Prefer patch changesets by default. Use a minor changeset only when
  there is a compelling reason for a minor release, such as a breaking change
  while the major version is 0, which caret (^) ranges treat as incompatible
  and which a changeset signals with migration steps.
purpose: Keep routine release increments conservative and reserve larger
  increments for justified changes.
---
```diff
 ---
-"traits": minor
+"traits": patch
 ---
```
