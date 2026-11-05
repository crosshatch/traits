import { Command } from "effect/cli"

import { list } from "./list.ts"
import { login } from "./login/login.ts"
import { logout } from "./logout.ts"
import { status } from "./status.ts"

export const auth = Command.make("auth").pipe(
  Command.withDescription("Manage saved provider accounts"),
  Command.withSubcommands([login, list, status, logout])
)
