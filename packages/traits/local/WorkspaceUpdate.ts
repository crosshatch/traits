import { Effect } from "effect"

import PackageJson from "../package.json" with { type: "json" }
import * as Version from "../Version.ts"
import * as Changelog from "./Changelog.ts"
import * as TraitsConfig from "./TraitsConfig.ts"

/** Structured migration information; gathering it never changes workspace files or upgrades packages. */
export interface WorkspaceUpdateContext {
  readonly from: { readonly version: string; readonly source: "flag" | "workspace" | "installed" | "internal" }
  readonly installed: string
  readonly latest: string
  readonly releases: ReadonlyArray<Changelog.Release>
}

/** Looks up the releases needed to migrate a workspace, or an explicitly supplied starting version. */
export const load = Effect.fn("WorkspaceUpdate.load")(function* (
  options: { readonly from?: Version.Version | undefined } = {}
) {
  const configured = options.from === undefined ? yield* TraitsConfig.loadVersion : undefined
  const from: WorkspaceUpdateContext["from"] =
    options.from !== undefined
      ? { version: options.from, source: "flag" }
      : configured === "internal"
        ? { version: PackageJson.version, source: "internal" }
        : configured !== undefined
          ? { version: configured, source: "workspace" }
          : { version: PackageJson.version, source: "installed" }
  const latest = yield* Changelog.latestVersion
  const changelog = Version.isNewer(latest, from.version) ? yield* Changelog.fetchReleases(latest) : []
  const releases = Changelog.between(changelog, { from: from.version, to: latest })
  return { from, installed: PackageJson.version, latest, releases } satisfies WorkspaceUpdateContext
})

export type { WorkspaceUpdateContext as UpdateContext }
