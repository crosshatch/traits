---
"traits": patch
---

Fail concurrent `derive_trait` calls fast while another derivation awaits
interactive approval. Previously, a call queued behind an unanswered approval
form waited indefinitely; it now returns `TraitDerivationBusyError`, telling the
agent to retry after the pending approval finishes.
