import { Array, Console, Effect, Option, pipe, String } from "effect"
import { Command, Flag } from "effect/cli"

import * as WorkspaceUpdate from "../../../local/WorkspaceUpdate.ts"
import type { UpdateContext } from "../../../local/WorkspaceUpdate.ts"
import * as Version from "../../../Version.ts"

/** Everything an agent needs to migrate a workspace from one traits version to the latest release. */
export type { UpdateContext } from "../../../local/WorkspaceUpdate.ts"

const sourceLabel = {
  flag: "--from",
  workspace: "traits/_config.json",
  installed: "installed version; traits/_config.json has no readable version",
  internal: "installed version; traits/_config.json is internal to the traits repository"
} as const

/** Renders migration context as Markdown for an agent to act on; the agent, not this command, performs the migration. */
export const render = (context: UpdateContext): string => {
  const { from, installed, latest, releases } = context
  const summary = [
    "# Traits update",
    "",
    `- Workspace version (${sourceLabel[from.source]}): ${from.version}`,
    `- Installed version: ${installed}`,
    `- Latest published version: ${latest}`
  ]
  if (!Version.isNewer(latest, from.version)) {
    return pipe(
      [...summary, "", `Nothing has been released after ${from.version}; no migration is needed.`],
      Array.join("\n")
    )
  }
  return pipe(
    [
      ...summary,
      "",
      "## Migration",
      "",
      "Perform this migration yourself; no command rewrites configuration or trait files.",
      "",
      ...(Version.isNewer(latest, installed)
        ? [`1. Upgrade traits to ${latest}.`]
        : [`1. Keep traits at ${latest} or later.`]),
      `2. Read each release below, oldest first, and apply every change it describes to traits/_config.json and the workspace's trait files, validating them against the upgraded package's schemas.`,
      `3. Set "version" in traits/_config.json to ${latest}.`,
      "",
      `## Releases after ${from.version}`,
      ...Array.flatMap(releases, (release) => [
        "",
        `### ${release.version}`,
        "",
        // Nest the release's own headings beneath its version heading.
        pipe(release.notes, String.replace(/^(#+ )/gmu, "#$1")) || "No notes."
      ])
    ],
    Array.join("\n")
  )
}

/** Prints what changed since the workspace's traits version so an agent can migrate configuration and trait files. */
export const update = Command.make(
  "update",
  {
    from: Flag.String("from").pipe(
      Flag.withSchema(Version.Version),
      Flag.withDescription("Version to migrate from instead of the one in traits/_config.json"),
      Flag.optional
    )
  },
  Effect.fn("update")(function* (params) {
    const context = yield* WorkspaceUpdate.load({ from: Option.getOrUndefined(params.from) })
    yield* Console.log(render(context))
  })
).pipe(Command.withDescription("Print the changes since this workspace's traits version so an agent can migrate it"))
