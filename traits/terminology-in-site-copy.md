---
name: terminology-in-site-copy
subject: User-facing copy and accessibility descriptions in files under
  traits.sh/, the project website.
match: "traits.sh/**/*.{ts,tsx,mts,cts,html,md,mdx}"
assertion: In traits.sh user-facing copy, including accessibility descriptions,
  call a saved or proposed reusable preference a “trait,” not a “rule.” Use
  “insight” for the lesson drawn from feedback before it is formulated as a
  trait.
purpose: Give users consistent terminology that distinguishes a captured
  preference from the insight that prompted it.
---

```diff
-<button>Save rule</button>
+<button>Save trait</button>
```

Out of scope: text outside traits.sh/, such as an MCP server's instructions or an approval message in package source, even when it says "rule".
