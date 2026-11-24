---
"traits": minor
---

Limit a run by what it costs: `--max-tokens` is removed, and `--stop-after-cost` ends a run once what its provider reports it to have cost reaches that many US dollars. Requests already under way are finished, so a run may cost somewhat more. What is not asked is left not assessed, and running again carries on from the answers already given.
