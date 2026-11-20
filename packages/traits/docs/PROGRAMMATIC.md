# Programmatic use

`traits` is the portable Effect API; importing it does not start a process, load
workspace files, or install model providers into your runtime. `traits/local`
adds filesystem, Git, workspace configuration, and provider integration. Neither
entry point requires a terminal or MCP client.

## Check supplied traits and text

```ts
import { Effect } from "effect"
import { Digest } from "effect/crypto"
import {
  Check,
  EnrichmentRegistry,
  Report,
  SegmenterRegistry,
  Trait,
  TraitName,
  TraitPurpose,
  WorkspacePath
} from "traits"

const check = Check.check({
  traits: [
    {
      trait: Trait.Trait.make({
        name: TraitName.TraitName.make("readable-code"),
        purpose: TraitPurpose.TraitPurpose.make("Keep code readable.")
      }),
      origin: Report.TraitOrigin.cases.Programmatic.make({})
    }
  ],
  changes: [
    { after: { path: WorkspacePath.make("example.ts"), text: "const x = 1" } }
  ]
}).pipe(
  Effect.provide([
    SegmenterRegistry.layer(() => Effect.die("No segmenter configured")),
    EnrichmentRegistry.layer(() => Effect.die("No enrichment configured")),
    Digest.layerWebCrypto
  ])
)
```

Provide your `DecisionModel` layer before running this Effect. Guidance-only
traits, as above, do not call it; subjects and assertions do. Model providers
are caller-controlled. `DecisionLimit.layer` and `DecisionBatching.layer` are
available for custom model wiring. Use `Report.verdicts(report, policy)` to
interpret a completed report; successful execution alone is not a passing
verdict.

For extensions, pass setup effects to `SegmenterRegistry.layer` and
`EnrichmentRegistry.layer`. These constructors require only the services your
effects use, share setup for their runtime lifetime, and create fresh execution
chats and scopes. Keep their layers alive in a scoped runtime across checks to
reuse setup. Extension identities remain normalized `WorkspacePath` values, but
these registries do not resolve or import files. Missing identities should fail,
not silently produce an empty selection.

Constrain default-exported extension effects with
`satisfies Enrichment.Enrichment` or `satisfies Segmenter.Segmenter` to check
their error channels and service requirements without widening inferred types.
Enrichments using additional host services can declare them as
`Enrichment.Enrichment<WorkspaceRoot>` for local workspace access.

## Check a local workspace

```ts
import { NodeServices } from "@effect/platform-node"
import { DateTime, Effect } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore } from "effect/persistence"
import { WorkspaceCheck, WorkspaceRoot } from "traits/local"

const result = await Effect.runPromise(
  WorkspaceCheck.WorkspaceCheck.use((checker) =>
    checker.check({
      paths: ["src/example.ts"]
    })
  ).pipe(
    Effect.provide(WorkspaceCheck.WorkspaceCheck.layer),
    Effect.provide(WorkspaceRoot.layer("/absolute/workspace")),
    Effect.provide([
      NodeServices.layer,
      FetchHttpClient.layer,
      Digest.layerWebCrypto,
      SecureRandom.layerWebCrypto,
      KeyValueStore.layerMemory,
      DateTime.layerCurrentZoneLocal
    ])
  )
)
```

This returns `{ report, policy }`, reloading workspace configuration and traits
on each call. Install `@effect/platform-node` for Node integration; it is an
optional peer for portable consumers.

## Derive without a filesystem or interactive approval

`TraitDerivation.prepare(document, existing)` accepts a
`TraitFile.TraitDocument` and existing `{ name, text }` snapshots. Provide
decision and language model layers. It returns `Blocked` or `Proposed`. A
blocked plan carries a `reason`: `Covered`, `Unresolved`, or `NameTaken`.

A `Proposed` plan carries the final `document`, exact serialized `text`,
optional `current` snapshot, and replacement relationship and explanation. Your
host can present it in any approval UI, then persist it after approval and
checking that the snapshot is still current. Preparation never approves or saves
anything. The host must validate extension references for its own execution
environment. `WorkspaceDerive` remains the local approval-and-save convenience
API.

Approval callbacks may return `Defer` to return an `ApprovalRequired` result
without saving or keeping a call open. Its request includes the document, exact
proposed text, and current-file snapshot for client-managed review.

## Other local operations

- `WritableTraitStore` persists imports and tracked-source refreshes without
  running an agent or prompting in the terminal. Its results identify the
  installed, changed, and removed traits, plus newly created environments.
- `WorkspaceApply.prepare(selection)` generates one application report and
  returns a prompt for the calling agent. `WorkspaceApply.run(selection)` also
  runs a configured headless agent when present. Application can be retried
  independently of ingestion.
- `CodingAgent.run(config, prompt, session?)` returns `Done` or `InputRequired`.
  A caller can obtain a user's answer and pass it with the returned session ID
  to resume; no language model answers on the user's behalf.

- `WorkspaceUpdate.load({ from? })` returns structured migration context without
  changing files or upgrading packages.
- Experimental `User.Profiles` provides `list`, `get`, `save`, `use`, `remove`,
  and `resolve`. Use `User.Profiles.resolveSelection` to resolve custom layer
  paths before saving them; it delegates to the model-selection module.
- Experimental `User.Accounts.save`, `User.Accounts.list`, and
  `User.Accounts.remove` manage owner-only local credentials. Lists contain
  metadata, not secrets; removal checks profile references and does not revoke
  remote keys.

User operations require platform services, `User.UserPaths`,
`User.UserFileSecurity`, and, for mutations, `User.UserConfigLock`. Provide
these services once for the host; mutations own their locks and must not be
wrapped in another user lock. Profile selections do not yet configure
`WorkspaceModels`.
