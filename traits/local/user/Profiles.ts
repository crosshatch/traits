import { Array, Effect, FileSystem, Path, Record, Schema as S } from "effect"

import * as Accounts from "./Accounts.ts"
import { ModelSelection } from "./Profile/ModelSelection.ts"
import type { Profile } from "./Profile/Profile.ts"
import type { ProfileName } from "./Profile/ProfileName.ts"
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
  return yield* UserConfig.resolveProfile(config, name)
})

/** Resolves and validates a custom layer file relative to the host's Path service; provider references are unchanged. Does not import or execute the module. */
export const resolveSelection = Effect.fn("Profiles.resolveSelection")(function* (selection: ModelSelection) {
  if (selection._tag === "Provider") return selection
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const filename = path.resolve(selection.path)
  yield* fs.stat(filename).pipe(
    Effect.mapError(() =>
      ProfileOperationError.make({ message: `Cannot access custom model layer file: ${filename}` })
    ),
    Effect.filterOrFail(
      (info) => info.type === "File",
      () => ProfileOperationError.make({ message: `Custom model layer path is not a file: ${filename}` })
    )
  )
  return ModelSelection.cases.Custom.make({ path: filename })
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
