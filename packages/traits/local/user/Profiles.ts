import { Array, Effect, Option, Record, Schema as S } from "effect"

import * as Accounts from "./Accounts.ts"
import { ModelSelection } from "./Profile/ModelSelection.ts"
import type { Profile } from "./Profile/Profile.ts"
import { ProfileName } from "./Profile/ProfileName.ts"
import * as UserConfig from "./UserConfig.ts"
import { withLock } from "./UserConfigLock.ts"
import { UserPaths } from "./UserPaths.ts"

/** A profile mutation would violate the saved configuration's invariants. */
export class ProfileOperationError extends S.TaggedError<ProfileOperationError>()("ProfileOperationError", {
  message: S.String
}) {}

/** Lists saved profiles without requiring a selected default profile. */
export const list = UserConfig.read.pipe(Effect.map((config) => config.profiles))

/** Resolves an explicit profile, workspace selection, or default. */
export const get = Effect.fn("Profiles.get")(function* (name?: ProfileName) {
  const config = yield* UserConfig.read
  return yield* resolve(config, name)
})

export { resolve as resolveSelection } from "./Profile/ModelSelection.ts"

/** The selected profile does not exist. */
export class ProfileNotFoundError extends S.TaggedError<ProfileNotFoundError>()("ProfileNotFoundError", {
  profile: ProfileName.annotateKey({ description: "The selected profile name." })
}) {
  override get message(): string {
    return `Selected profile ${this.profile} does not exist. Create it with traits profile create ${this.profile}, or select an existing workspace profile with traits profile use <name>.`
  }
}

/** Resolves an explicit name, workspace override, or default from a configuration snapshot. */
export const resolve = Effect.fn("Profiles.resolve")(function* (
  config: UserConfig.UserConfig,
  explicitName?: ProfileName
) {
  let selected = explicitName
  if (selected === undefined) {
    const { workspaceKey } = yield* UserPaths
    selected = config.workspaceProfiles[workspaceKey] ?? ProfileName.make("default")
  }
  return yield* Array.findFirst(config.profiles, (entry) => entry.name === selected).pipe(
    Option.match({ onSome: Effect.succeed, onNone: () => ProfileNotFoundError.make({ profile: selected }) })
  )
})

/** Saves model selections after checking account references; custom module paths must already be resolved by the host. */
export const save = Effect.fn("Profiles.save")(function* (
  name: ProfileName,
  profile: Profile,
  options: { readonly replace?: boolean } = {}
) {
  const config = yield* UserConfig.read
  if (options.replace !== true && Array.some(config.profiles, (entry) => entry.name === name)) {
    return yield* ProfileOperationError.make({
      message: `Profile ${name} already exists. Explicitly replace it to overwrite it.`
    })
  }
  const selections = Array.filter([profile.language, profile.decision], ModelSelection.guards.Provider)
  if (selections.length > 0) {
    const accounts = yield* Accounts.read
    for (const selection of selections) {
      if (!Array.some(accounts, (account) => account.id === selection.account)) {
        return yield* ProfileOperationError.make({
          message: `Unknown account: ${selection.account}. Save the account first.`
        })
      }
    }
  }
  yield* UserConfig.write({
    ...config,
    profiles: [...Array.filter(config.profiles, (entry) => entry.name !== name), { name, profile }]
  })
}, withLock)

/** Selects an existing profile for the current workspace. Selecting default removes the override. */
export const use = Effect.fn("Profiles.use")(function* (name: ProfileName) {
  const config = yield* UserConfig.read
  if (!Array.some(config.profiles, (entry) => entry.name === name)) {
    return yield* ProfileOperationError.make({ message: `Unknown profile: ${name}` })
  }
  const { workspaceKey } = yield* UserPaths
  yield* UserConfig.write({
    ...config,
    workspaceProfiles:
      name === "default"
        ? Record.remove(config.workspaceProfiles, workspaceKey)
        : { ...config.workspaceProfiles, [workspaceKey]: name }
  })
  return { workspaceKey }
}, withLock)

/** Removes a profile; force also permits removing default and clears workspace references. */
export const remove = Effect.fn("Profiles.remove")(function* (
  name: ProfileName,
  options: { readonly force?: boolean } = {}
) {
  const config = yield* UserConfig.read
  if (!Array.some(config.profiles, (entry) => entry.name === name)) {
    return yield* ProfileOperationError.make({ message: `Unknown profile: ${name}` })
  }
  if (
    options.force !== true &&
    (name === "default" || Record.some(config.workspaceProfiles, (selected) => selected === name))
  ) {
    return yield* ProfileOperationError.make({
      message: `Profile ${name} is the default profile or selected by a workspace. Explicitly force removal to clear its workspace selections.`
    })
  }
  yield* UserConfig.write({
    ...config,
    profiles: Array.filter(config.profiles, (entry) => entry.name !== name),
    workspaceProfiles: Record.filter(config.workspaceProfiles, (selected) => selected !== name)
  })
}, withLock)
