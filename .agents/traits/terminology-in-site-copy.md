---
name: terminology-in-site-copy
subject: User-facing copy and accessibility descriptions in files under
  traits.sh/, the project website. In TypeScript, TSX, HTML, or Markdown files
  under traits.sh/. Files outside traits.sh/, such as package source, CLI and
  MCP messages, and repository documentation, are out of scope.
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
