import { Cause, Effect, Layer, Schema as S } from "effect"
import { McpServer, Tool, Toolkit } from "effect/ai"

const toolkit = Toolkit.make(
  Tool.make("traits_configuration_error", {
    description:
      "Traits failed to initialize. Call this tool to learn where configuration failed. Help the user fix setup, then restart the Traits MCP server before using Traits. Never ask the user to paste credentials into chat.",
    parameters: Tool.EmptyParams,
    success: S.Never,
    failure: S.String,
    failureMode: "return"
  }).annotate(Tool.Readonly, true)
)

export const layer = (cause: Cause.Cause<unknown>) =>
  Cause.hasInterruptsOnly(cause)
    ? Layer.effectDiscard(Effect.interrupt)
    : McpServer.toolkit(toolkit).pipe(
        Layer.provide(
          toolkit.toLayer({
            traits_configuration_error: () =>
              Effect.fail(
                `${Cause.pretty(cause)}\n\nFix the reported error, then restart the Traits MCP server and retry. Do not paste credentials into chat.`
              )
          })
        )
      )
