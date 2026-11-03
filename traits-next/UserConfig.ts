import { Schema as S } from "effect"

import { Profile, ProfileName } from "./Cli/Profile/Profile.ts"

/** User-level profiles and the selected profile name; contains no credentials. */
export type UserConfig = typeof UserConfig.Type
export const UserConfig = S.Struct({
  profiles: S.Array(S.Struct({ name: ProfileName, profile: Profile })),
  activeProfile: ProfileName.pipe(S.optionalKey)
})
