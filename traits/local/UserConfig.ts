import { Array, Effect, FileSystem, Option, pipe, Schema as S } from "effect"

import * as AtomicFile from "./AtomicFile.ts"
import { Profile, ProfileName } from "./Profile/Profile.ts"
import { UserPaths } from "./UserPaths.ts"

/** User-level profiles and workspace overrides; the profile named default is the fallback. Contains no credentials. */
export type UserConfig = typeof UserConfig.Type
export const UserConfig = S.Struct({
  profiles: S.Array(S.Struct({ name: ProfileName, profile: Profile })),
  /** Profile overrides keyed by canonical Git common directory, or canonical cwd outside Git. */
  workspaceProfiles: S.Record(S.NonEmptyString.check(S.isTrimmed()), ProfileName)
    .pipe(S.withDecodingDefaultKey(Effect.succeed({})))
    .annotateKey({
      description: "Profile overrides keyed by canonical Git common directory, or canonical cwd outside Git."
    })
}).annotate({
  description:
    "User-level profiles and workspace overrides; the profile named default is the fallback. Contains no credentials."
})

/** The profiles file could not be read or does not contain valid profiles. */
export class UserConfigReadError extends S.TaggedError<UserConfigReadError>()("UserConfigReadError", {
  /** The profiles file path. */
  path: S.String.annotateKey({ description: "The profiles file path." }),
  /** The underlying read or decoding failure. */
  cause: S.Defect().annotateKey({ description: "The underlying read or decoding failure." })
}) {
  override get message(): string {
    return `Could not read profiles from ${this.path}. Check that the file is readable and contains valid profile JSON.`
  }
}

/** The profiles file could not be saved. */
export class UserConfigWriteError extends S.TaggedError<UserConfigWriteError>()("UserConfigWriteError", {
  /** The profiles file path. */
  path: S.String.annotateKey({ description: "The profiles file path." }),
  /** The underlying write failure. */
  cause: S.Defect().annotateKey({ description: "The underlying write failure." })
}) {
  override get message(): string {
    return `Could not save profiles to ${this.path}. Check directory ownership, permissions, and available disk space.`
  }
}

/** The selected profile does not exist. */
export class ProfileNotFoundError extends S.TaggedError<ProfileNotFoundError>()("ProfileNotFoundError", {
  /** The selected profile name. */
  profile: ProfileName.annotateKey({ description: "The selected profile name." })
}) {
  override get message(): string {
    return `Selected profile ${this.profile} does not exist. Create it with traits profile create ${this.profile}, or select an existing workspace profile with traits profile use <name>.`
  }
}

/** Reads fresh profile settings; missing configuration is empty. */
export const read = Effect.gen(function* () {
  const { config } = yield* UserPaths
  const fs = yield* FileSystem.FileSystem
  if (!(yield* fs.exists(config))) {
    return UserConfig.make({ profiles: [], workspaceProfiles: {} })
  }
  const text = yield* fs.readFileString(config)
  return yield* pipe(text, S.decodeEffect(S.fromJsonString(UserConfig)))
}).pipe(
  Effect.catch((cause) => UserPaths.use((paths) => UserConfigReadError.make({ path: paths.config, cause }))),
  Effect.withSpan("UserConfig.read")
)

/** Replaces the complete configuration; coordinate read-modify-write operations with UserConfigLock. */
export const write = Effect.fn("UserConfig.write")(
  function* (saved: UserConfig) {
    const { config } = yield* UserPaths
    // The configuration is already typed, so an encoding failure is a bug here, not something the user can fix.
    const text = yield* pipe(saved, S.encodeEffect(S.fromJsonString(UserConfig)), Effect.orDie)
    yield* AtomicFile.write(config, text)
  },
  Effect.catch((cause) => UserPaths.use((paths) => UserConfigWriteError.make({ path: paths.config, cause })))
)

/** Resolves an explicit name, workspace override, or the profile named default; missing profiles fail. */
export const resolveProfile = Effect.fn("UserConfig.resolveProfile")(function* (
  config: UserConfig,
  explicitName?: ProfileName
) {
  let selected = explicitName
  if (selected === undefined) {
    const { workspaceKey } = yield* UserPaths
    selected = config.workspaceProfiles[workspaceKey] ?? ProfileName.make("default")
  }
  return yield* Array.findFirst(config.profiles, (entry) => entry.name === selected).pipe(
    Option.match({
      onSome: Effect.succeed,
      onNone: () => ProfileNotFoundError.make({ profile: selected })
    })
  )
})
