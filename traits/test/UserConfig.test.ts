import { expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"

import { ModelSelection } from "../local/user/Profile/ModelSelection.ts"
import { Profile, ProfileName } from "../local/user/Profile/Profile.ts"
import * as UserConfig from "../local/user/UserConfig.ts"
import { UserPaths } from "../local/user/UserPaths.ts"

const layer = ModelSelection.cases.Custom.make({ path: "layer.ts" })
const profile = Profile.make({ language: layer, decision: layer })
const config = UserConfig.UserConfig.make({
  profiles: [
    { name: ProfileName.make("default"), profile },
    { name: ProfileName.make("work"), profile }
  ],
  workspaceProfiles: { "/a/.git": ProfileName.make("work"), "/b/.git": ProfileName.make("missing") }
})

it.effect("resolves an explicit profile, then the workspace override, then the profile named default", () =>
  Effect.gen(function* () {
    const resolve = (workspaceKey: string, explicitName?: ProfileName) =>
      UserConfig.resolveProfile(config, explicitName).pipe(
        Effect.provide(
          Layer.succeed(
            UserPaths,
            UserPaths.of({
              workspaceKey,
              dataDirectory: "/data",
              config: "/config/profiles.json",
              accounts: "/data/credentials.json",
              lock: "/data/cli.lock"
            })
          )
        )
      )
    const overridden = yield* resolve("/a/.git")
    expect(overridden.name).toBe("work")
    const fallback = yield* resolve("/c/.git")
    expect(fallback.name).toBe("default")
    const explicit = yield* resolve("/a/.git", ProfileName.make("default"))
    expect(explicit.name).toBe("default")
    const dangling = yield* Effect.flip(resolve("/b/.git"))
    expect(dangling.message).toContain("missing")
  })
)
