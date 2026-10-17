---
name: minimal-test-grouping
when: writing or organizing test files and describe blocks.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
skip: When every describe block under assessment organizes a meaningful behavior group rather than merely repeating the filename or subject.
---

```diff
-describe("parse", () => { it("preserves the body", testBody) })
+it("preserves the body", testBody)
```

---
Keep test files minimally structured: write tests at the top level and omit outer describe blocks that merely repeat the filename or subject. Add named describe blocks only when they organize meaningful behavior groups.
