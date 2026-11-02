import { Layer } from "effect"
import { Command } from "effect/cli"
import { UserDirectories } from "effect/persistence"

import PackageJson from "../package.json" with { type: "json" }
import * as UserConfigStore from "../UserConfigStore/UserConfigStore.ts"
import { UserFileSecurity } from "../UserFileSecurity.ts"
import { auth } from "./commands/auth/auth.ts"
import { profile } from "./commands/profile/profile.ts"
import { UserConfigLock } from "./UserConfigLock.ts"
import * as WorkspacePaths from "./WorkspacePaths.ts"

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Manage trait checking credentials and model profiles"),
  Command.withSubcommands([auth, profile]),
  Command.provide(
    Layer.mergeAll(UserConfigStore.layerFromFs, UserConfigLock.layer).pipe(
      Layer.provideMerge(UserFileSecurity.layer),
      Layer.provideMerge(WorkspacePaths.layer),
      Layer.provideMerge(UserDirectories.layer)
    )
  ),
  Command.run({ version: PackageJson.version })
)
