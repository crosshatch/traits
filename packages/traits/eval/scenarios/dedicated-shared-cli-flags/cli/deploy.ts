import { Console, Effect } from "effect"
import { Command, Flag } from "effect/cli"

export const deployFlags = {
  environment: Flag.Literals("environment", ["staging", "production"]).pipe(
    Flag.withAlias("e"),
    Flag.withDescription("Target environment")
  ),
  region: Flag.String("region").pipe(Flag.withDefault("us-east-1"), Flag.withDescription("Cloud region")),
  dryRun: Flag.Boolean("dry-run").pipe(Flag.withDescription("Print the plan without applying it"))
}

export const deploy = Command.make(
  "deploy",
  { ...deployFlags, tag: Flag.String("tag").pipe(Flag.withDescription("Image tag to deploy")) },
  Effect.fn("deploy")(function* (params) {
    yield* Console.log(`Deploying ${params.tag} to ${params.environment} in ${params.region}`)
    if (params.dryRun) {
      return
    }
    yield* Console.log("Deployment started.")
  })
).pipe(Command.withDescription("Deploy an image tag"))
