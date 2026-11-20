import { Console, Effect } from "effect"
import { Command, Flag } from "effect/cli"

export const buildFlags = {
  target: Flag.Literals("target", ["node", "browser"]).pipe(
    Flag.withAlias("t"),
    Flag.withDescription("Build target")
  ),
  outDir: Flag.String("out-dir").pipe(Flag.withDefault("dist"), Flag.withDescription("Output directory")),
  minify: Flag.Boolean("minify").pipe(Flag.withDescription("Minify the output"))
}

export const build = Command.make(
  "build",
  { ...buildFlags, entry: Flag.String("entry").pipe(Flag.withDescription("Entry module")) },
  Effect.fn("build")(function* (params) {
    yield* Console.log(`Building ${params.entry} for ${params.target} into ${params.outDir}`)
    if (params.minify) {
      yield* Console.log("Minifying output.")
    }
    yield* Console.log("Build finished.")
  })
).pipe(Command.withDescription("Build the project"))
