import { Layer, pipe, String } from "effect"
import { McpProtocol, McpServer, Toolkit } from "effect/ai"

import PackageJson from "../package.json" with { type: "json" }
import * as TraitsCheck from "./TraitsCheck.ts"
import * as TraitsDerive from "./TraitsDerive.ts"

/** The traits MCP server over stdio, registering its tools before it reads its first request; the host provides the WorkspaceCheck and WorkspaceDerive its tools use. */
export const layer = McpServer.layerStdio({
  name: "traits",
  version: PackageJson.version,
  protocols: [McpProtocol.v2025_11_25],
  instructions: pipe(
    String.stripMargin(`
    |Traits are this workspace's durable rules, one per .agents/traits/<name>.md file.
    |Whenever user feedback may contain an insight worth applying beyond the current task, call traits.derive; only it saves traits, after the user approves.
    |Before finishing a task, call traits.check once, in a single call, on every file the task created, edited, or deleted, against every trait; do not check after each edit. After fixing findings, recheck only the affected files and traits. When a trait is created or changed, call traits.check with that trait and no paths once its wording is final.
    |Read the trait and the code before acting on a finding. Fix confirmed violations with minimal edits that keep behavior, and check again. Never weaken a trait or skip a check to silence a finding; if a trait seems wrong, ask the user and propose a clarification through traits.derive.
    |A failed tool call is neither a pass nor a finding: resolve it or report it, and never claim compliance the checks did not show.
    |If a trait file cannot be read or parsed, ask the user before editing it; \`traits update\` prints migration steps for outdated workspaces.
    `),
    String.trim
  ),
  registrations: McpServer.toolkit(Toolkit.merge(TraitsDerive.toolkit, TraitsCheck.toolkit)).pipe(
    Layer.provide([TraitsDerive.layer, TraitsCheck.layer])
  )
})
