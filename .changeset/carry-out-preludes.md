---
"traits": patch
---

Carry out trait preludes. A trait's `prelude` is now handed to an agent named
under `prelude` in `traits/config.json` (a command given each task's
instructions as its last argument), and what it finds is added to the evidence
the trait's assertion is checked against. A trait with a prelude is checked once
against the whole file, and is left not assessed when there is no agent, the
agent fails, or it replies `CANNOT CHECK:`. Answers are remembered by the file
and the trait, not by what the agent found, so a prelude is only carried out
again when either changes. What an agent reports a task cost, as
`claude -p --output-format json` does, counts against `--stop-after-cost`, and
reports and `--dry` count prelude tasks.
