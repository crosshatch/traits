import { Console, Effect, Option } from "effect"
import { Argument, Command, Flag } from "effect/cli"

import { EnvironmentName } from "../../../EnvironmentName.ts"
import { WritableTraitStore } from "../../../local/WritableTraitStore.ts"
import * as Apply from "../apply/apply.ts"

export const add = Command.make(
  "add",
  {
    source: Argument.String("source"),
    environment: Flag.String("environment").pipe(Flag.withSchema(EnvironmentName), Flag.optional),
    track: Flag.Boolean("track").pipe(Flag.withDefault(false)),
    deep: Flag.Boolean("deep").pipe(Flag.withDefault(false)),
    force: Flag.Boolean("force").pipe(Flag.withDefault(false)),
    apply: Flag.Boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply the imported traits after ingestion")
    )
  },
  Effect.fn("add")(function* (params) {
    const store = yield* WritableTraitStore
    const { traits, changed, environmentsCreated } = yield* store.add(params.source, {
      track: params.track,
      deep: params.deep,
      force: params.force,
      environment: Option.getOrUndefined(params.environment)
    })
    yield* Console.log(`Imported ${traits.length} traits (${changed.length} changed).`)
    for (const environment of environmentsCreated) {
      yield* Console.log(`Created environment ${environment}.`)
    }
    if (params.apply && traits.length > 0) {
      yield* Apply.run({ traits })
    }
  })
).pipe(
  Command.withDescription(
    "Ingest traits from a file, directory, GitHub source, or URL; optionally apply them with --apply"
  )
)
