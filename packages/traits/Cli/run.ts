import { Effect } from "effect"
import { Argument, Command, Flag } from "effect/cli"

// lists, threshold, traits
export const run = Command.make(
  "run",
  {
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the full report as JSON instead of a readable summary")
    ),
    paths: Argument.String("paths").pipe(
      Argument.withDescription(
        "Files to check, relative to the workspace root; every project file Git does not ignore when omitted"
      ),
      Argument.atLeast(0)
    ),
    traits: Flag.String("trait").pipe(
      Flag.withSchema(TraitName),
      Flag.withDescription("Check only this trait, within the list when one is given; repeat to select several"),
      Flag.atLeast(0)
    ),
    lists: Flag.String("list").pipe(
      Flag.withSchema(ListName),
      Flag.withAlias("l"),
      Flag.withDescription("Check only the traits in this list from traits/lists.json; every trait when omitted"),
      Flag.optional
    ),
    threshold: Flag.Finite(name).pipe(Flag.withSchema(Probability), Flag.withDescription(description), Flag.optional)
  },
  Effect.fn("run")(function* () {
    // ...
  })
).pipe(
  Command.withDescription(
    "Check files against this workspace's traits and print readable results; --json prints the full report. Without a policy, display thresholds are 0.5 and do not affect exit status. With --fail and --pass, or check.policy in traits/config.json, print the verdict to stderr and exit 0 for Pass, 1 for Fail, 2 for Incomplete or a check that could not run, and 3 for Inconclusive; invalid command-line usage also exits 1."
  )
)
