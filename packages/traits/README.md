# Traits

**Reusable preferences for your AI agent.**

[![npm](https://img.shields.io/npm/v/traits?style=flat-square&color=6D5BD0&label=traits)](https://www.npmjs.com/package/traits)
[![license](https://img.shields.io/badge/license-Apache%202.0-6D5BD0?style=flat-square)](https://github.com/crosshatch/traits/blob/main/LICENSE)
[![discord](https://img.shields.io/badge/discord-join-6D5BD0?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/CSXCRUKjh9)

Traits turns feedback into preferences your agent can use across tasks and
sessions. Each trait is a Markdown file in `traits/<name>.md`:

```markdown
---
name: direct-callbacks
subject: Callbacks passed to functions.
assertion: >
  Pass compatible functions directly instead of wrapping them in forwarding
  arrows.
purpose: Expose callback behavior without redundant wrappers.
---
```

Your agent proposes traits, asks you to approve each one, and checks its work
against them through MCP. The files live in your project, so you can edit,
review, and share them with your team.

## Get started

Paste this into your agent inside your project:

```text
Set up Traits using https://github.com/crosshatch/traits/blob/main/SETUP.md.
Follow this project's conventions, ask me to choose providers and models, and
preserve existing configuration.
```

## Check in CI

`traits check` checks files against the project's traits from the command line
and prints the report as JSON. Given a decision policy, it exits nonzero when a
trait is violated, so CI can gate on it. See the
[command line guide](https://github.com/crosshatch/traits/blob/main/SETUP.md#command-line).

## Programmatic use

`traits` is the portable Effect API; importing it does not start a process, load
workspace files, or install model providers into your runtime. `traits/local`
adds filesystem, Git, workspace configuration, and provider integration. Neither
entry point requires a terminal or MCP client.

### Check supplied traits and text

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

### Check a local workspace

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

### Derive without a filesystem or interactive approval

`TraitDerivation.prepare(document, existing)` accepts a
`TraitFile.TraitDocument` and existing `{ name, text }` snapshots. Provide
decision and language model layers. It returns `Covered`, `Unresolved`,
`NameTaken`, or `Proposed`.

A `Proposed` plan carries the final `document`, exact serialized `text`,
optional `current` snapshot, and replacement relationship and explanation. Your
host can present it in any approval UI, then persist it after approval and
checking that the snapshot is still current. Preparation never approves or saves
anything. The host must validate extension references for its own execution
environment. `WorkspaceDerive` remains the local approval-and-save convenience
API.

### Other local operations

- `WorkspaceUpdate.load({ from? })` returns structured migration context without
  changing files or upgrading packages.
- Experimental `User.Profiles` provides `list`, `get`, `save`, `use`, `remove`,
  and `resolveSelection`. Resolve custom layer paths before saving them.
- Experimental `User.Accounts.save`, `User.Accounts.list`, and
  `User.Accounts.remove` manage owner-only local credentials. Lists contain
  metadata, not secrets; removal checks profile references and does not revoke
  remote keys.

User operations require platform services, `User.UserPaths`,
`User.UserFileSecurity`, and, for mutations, `User.UserConfigLock`. Provide
these services once for the host; mutations own their locks and must not be
wrapped in another user lock. Profile selections do not yet configure
`WorkspaceModels`.

## License

[Apache-2.0](https://github.com/crosshatch/traits/blob/main/LICENSE)
