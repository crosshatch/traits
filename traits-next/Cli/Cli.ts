import { Layer } from "effect"
import { Command } from "effect/cli"
import { UserDirectories } from "effect/persistence"

import PackageJson from "../package.json" with { type: "json" }
import { auth } from "./commands/auth/auth.ts"
import { profile } from "./commands/profile/profile.ts"
import * as FsUserConfigStore from "./FsUserConfigStore.ts"
import { UserConfigLock } from "./UserConfigLock.ts"
import { UserFileSecurity } from "./UserFileSecurity.ts"
import * as WorkspacePaths from "./WorkspacePaths.ts"

export const Cli = Command.make("traits").pipe(
  Command.withDescription("Manage trait checking credentials and model profiles"),
  Command.withSubcommands([auth, profile]),
  Command.provide(
    Layer.mergeAll(FsUserConfigStore.layer, UserConfigLock.layer).pipe(
      Layer.provideMerge(UserFileSecurity.layer),
      Layer.provideMerge(WorkspacePaths.layer),
      Layer.provideMerge(UserDirectories.layer)
    )
  ),
  Command.run({ version: PackageJson.version })
)
