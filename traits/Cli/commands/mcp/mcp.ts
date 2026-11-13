import { Effect, Layer, Logger } from "effect"
import { Command } from "effect/cli"

import { WorkspaceCheck } from "../../../local/WorkspaceCheck.ts"
import { WorkspaceDerive } from "../../../local/WorkspaceDerive.ts"
import { WorkspaceRoot } from "../../../local/WorkspaceRoot.ts"
import { Server } from "../../../mcp/index.ts"

/** Runs the traits MCP server over stdio until the client disconnects; logs go to stderr so they never corrupt the protocol stream. */
export const mcp = Command.make("mcp").pipe(
  Command.withDescription("Run the traits MCP server over stdio"),
  Command.withHandler(() =>
    Layer.launch(
      // Checking and deriving in the current directory's workspace; the server reports failures building them through its tools.
      Server.layer(
        Layer.mergeAll(WorkspaceCheck.layer, WorkspaceDerive.layer).pipe(Layer.provide(WorkspaceRoot.layer(".")))
      )
    ).pipe(Effect.provideService(Logger.LogToStderr, true))
  )
)
