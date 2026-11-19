---
name: separate-workflow-state-from-outcome-detail
subject: Types or schemas composing workflow states with an existing outcome union.
assertion: When a workflow distinguishes broad states, model those as the outer
  tagged union and nest the existing outcome union within the relevant variant.
  Avoid flattening detailed outcomes into the outer union when they describe a
  different level of meaning. Flattening remains appropriate when all variants
  genuinely represent alternatives at the same conceptual level.
purpose: Keep workflow branching clear while preserving reusable outcome types
  and their ownership.
---

Compose according to meaning, not merely structural compatibility.

```ts
type Plan = Data.TaggedEnum<{
  Blocked: { readonly reason: BlockedDerivation }
  Proposed: { readonly proposal: Proposal }
}>
```

Here the plan distinguishes whether a write can be proposed; BlockedDerivation separately describes why it cannot.
