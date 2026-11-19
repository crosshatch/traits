import { Cause, Effect, Layer, pipe, String } from "effect"
import { McpProtocol, McpServer, Toolkit } from "effect/ai"

import type * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import type * as WorkspaceDerive from "../local/WorkspaceDerive.ts"
import PackageJson from "../package.json" with { type: "json" }
import * as ToolFailure from "./ToolFailure.ts"
import * as TraitsCheck from "./TraitsCheck.ts"
import * as TraitsDerive from "./TraitsDerive.ts"

const instructions = String.stripMargin(`
|Traits are this workspace's durable rules, one per traits/<name>.md file.
|After user corrections, preferences, and approval or rejection of an approach, actively identify the reusable lesson and call traits.derive when it may apply beyond this task. A specific file or command is not by itself a reason to skip derivation. Tell the user what you propose before calling. Follow ApprovalRequired instructions: show the proposal and ask the user through the client's native prompting mechanism, then return their decision with the reviewed snapshot. Only traits.derive saves traits, after explicit approval.
|Do not treat silence as successful learning or permission to save. Explain Covered or blocked results and report errors. ApprovalRequired returns control to you; there is no pending server-side approval to poll, no MCP form to trigger, and no approval CLI to run.
|Before finishing a task, call traits.check once, in a single call, on every file the task created, edited, or deleted, against every trait; do not check after each edit. After fixing findings, recheck only the affected files and traits. When a trait is created or changed, call traits.check with that trait and no paths once its wording is final.
|Read the trait and the code before acting on a finding. Fix confirmed violations with minimal edits that keep behavior, and check again. Never weaken a trait or skip a check to silence a finding; if a trait seems wrong, ask the user and propose a clarification through traits.derive.
|A failed tool call is neither a pass nor a finding: resolve it or report it, and never claim compliance the checks did not show.
|If a trait file cannot be read or parsed, ask the user before editing it; \`traits update\` prints migration steps for outdated workspaces.
`)

/** The traits tools. */
const toolkit = Toolkit.merge(TraitsDerive.toolkit, TraitsCheck.toolkit)

/** Stand-in tool handlers that return why the real ones could not start, so the client still connects and can tell the user what to fix. */
const unavailable = (cause: Cause.Cause<unknown>) => {
  const message = ToolFailure.describe(cause, {
    outcome: "The traits MCP server could not start its tools, so nothing was checked or saved.",
    recovery: "Once it is fixed, ask the user to restart the traits MCP server, then retry the same call."
  })
  return toolkit.toLayer({
    "traits.check": () => TraitsCheck.TraitsCheckFailure.make({ message }),
    "traits.derive": () => TraitsDerive.TraitsDeriveFailure.make({ message })
  })
}

/** The workspace services the tools use: checking and deriving, built however the host chooses. */
type WorkspaceServices<E, R> = Layer.Layer<WorkspaceCheck.WorkspaceCheck | WorkspaceDerive.WorkspaceDerive, E, R>

/** The tool handlers, built with the workspace services, or stand-ins returning why they could not be built. */
export const handlers = <E, R>(services: WorkspaceServices<E, R>) =>
  Layer.mergeAll(TraitsDerive.layer, TraitsCheck.layer).pipe(
    Layer.provide(services),
    Layer.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? // Shutting down while building is not a failure to report; the stand-ins are never built.
          Layer.unwrap(Effect.interrupt.pipe(Effect.as(unavailable(cause))))
        : unavailable(cause)
    )
  )

/** The traits MCP server over stdio, registering its tools before it reads its first request. Its tools use the given workspace services; if they or the tools cannot be built, the server still starts, and every tool call returns why. */
export const layer = <E, R>(services: WorkspaceServices<E, R>) =>
  McpServer.layerStdio({
    name: "traits",
    version: PackageJson.version,
    protocols: [McpProtocol.v2025_11_25],
    instructions: pipe(instructions, String.trim),
    registrations: McpServer.toolkit(toolkit).pipe(Layer.provide(handlers(services)))
  })
