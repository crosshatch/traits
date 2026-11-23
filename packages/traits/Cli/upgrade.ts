import { isSea } from "node:sea"

import { Array, Console, Effect, SemVer } from "effect"
import { CliError, Command } from "effect/cli"

import PackageJson from "../package.json" with { type: "json" }
import { targets, upgradeExecutable } from "./_upgradeExecutable.ts"

export const upgrade = Command.make(
  "upgrade",
  {},
  Effect.fn("upgrade")(function* () {
    if (!isSea()) {
      return yield* CliError.UserError.make({
        cause:
          "traits upgrade replaces the standalone executable, but this copy runs on Node.js. Upgrade it with your package manager, such as: npm install traits@latest"
      })
    }
    const target = `${process.platform}-${process.arch}`
    if (!Array.contains(targets, target)) {
      return yield* CliError.UserError.make({
        cause: `traits upgrade does not support ${target}. Download a release from https://github.com/crosshatch/traits/releases/latest`
      })
    }
    const { latest, upgraded } = yield* upgradeExecutable({
      executable: process.execPath,
      installed: SemVer.parseUnsafe(PackageJson.version),
      target
    })
    yield* Console.log(
      upgraded
        ? `Upgraded traits ${PackageJson.version} to ${SemVer.format(latest)}.`
        : `traits ${PackageJson.version} is up to date.`
    )
  })
).pipe(Command.withDescription("Replace this traits executable with the latest release from GitHub."))
