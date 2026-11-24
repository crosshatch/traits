---
"traits": patch
---

Allow multiple Traits MCP servers in one worktree, so concurrent agents no
longer fail with "A Traits MCP server already owns". Each server keeps a private
in-memory trait index, and trait writes are compare-and-swap commits serialized
by SQLite's write lock on the shared worktree database: a write based on a trait
another agent has since changed is rejected, and `derive_trait` asks for fresh
approval instead of overwriting it.
