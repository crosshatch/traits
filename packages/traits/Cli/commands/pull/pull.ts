import { Console, Effect } from "effect"
import { Argument, Command, Flag } from "effect/cli"

import { EnvironmentName } from "../../../EnvironmentName.ts"
import { WritableTraitStore } from "../../../local/WritableTraitStore.ts"
import * as Apply from "../apply/apply.ts"

export const pull = Command.make(
  "pull",
  {
    environments: Argument.String("environments").pipe(Argument.withSchema(EnvironmentName), Argument.atLeast(0)),
    force: Flag.Boolean("force").pipe(Flag.withDefault(false)),
    apply: Flag.Boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply the selected tracked traits after refreshing")
    )
  },
  Effect.fn("pull")(function* (options) {
    const store = yield* WritableTraitStore
    const { traits, changed, removed, environmentsCreated } = yield* store.pull({
      environments: options.environments,
      force: options.force
    })
    yield* Console.log(`Refreshed ${traits.length} traits (${changed.length} changed, ${removed.length} removed).`)
    for (const environment of environmentsCreated) {
      yield* Console.log(`Created environment ${environment}.`)
    }
    if (options.apply && traits.length > 0) {
      yield* Apply.run({ traits })
    }
  })
).pipe(Command.withDescription("Refresh tracked remote traits; optionally apply them with --apply"))
