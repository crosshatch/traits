import { Layer } from "effect"
import { Command } from "effect/cli"

import { UserConfigLock } from "../local/user/UserConfigLock.ts"
import { UserFileSecurity } from "../local/user/UserFileSecurity.ts"
import { UserPaths } from "../local/user/UserPaths.ts"
import { WorkspaceCheck } from "../local/WorkspaceCheck.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WritableTraitStore from "../local/WritableTraitStore.ts"
import PackageJson from "../package.json" with { type: "json" }
import { add } from "./commands/add/add.ts"
import { apply } from "./commands/apply/apply.ts"
import { auth } from "./commands/auth/auth.ts"
import { check } from "./commands/check/check.ts"
import { mcp } from "./commands/mcp/mcp.ts"
import { profile } from "./commands/profile/profile.ts"
import { pull } from "./commands/pull/pull.ts"
import { update } from "./commands/update/update.ts"

/** Locked access to user-level accounts and profiles; only commands that manage them build it. */
const userConfiguration = UserConfigLock.layer.pipe(
  Layer.provideMerge(UserFileSecurity.layer),
  Layer.provideMerge(UserPaths.layer)
)

/** The current directory's workspace root; only commands that work on the workspace build it. */
const root = WorkspaceRoot.layer(".")

/** Checking against the current directory's workspace. */
const workspace = WorkspaceCheck.layer.pipe(Layer.provide(root))
const application = workspace.pipe(Layer.provideMerge(root))
const ingestion = WritableTraitStore.layer.pipe(Layer.provide(root), Layer.provideMerge(application))

export const Cli = Command.make("traits").pipe(
  Command.withDescription(
    "Check files against traits, serve traits over MCP, and manage credentials and model profiles"
  ),
  Command.withSubcommands([
    auth.pipe(Command.provide(userConfiguration)),
    profile.pipe(Command.provide(userConfiguration)),
    check.pipe(Command.provide(workspace)),
    add.pipe(Command.provide(ingestion)),
    apply.pipe(Command.provide(application)),
    pull.pipe(Command.provide(ingestion)),
    mcp,
    update.pipe(Command.provide(root))
  ]),
  Command.run({ version: PackageJson.version })
)
