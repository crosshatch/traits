---
name: prefer-patch-changesets
when: authoring changesets or choosing a release increment.
mime: text/markdown
---

```diff
 ---
-"traits": minor
+"traits": patch
 ---
```

---
Prefer patch changesets by default. Use a minor changeset only when there is a compelling reason for a minor release.
