import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, Redacted } from "effect"

import * as Accounts from "../local/user/Accounts.ts"
import { ModelSelection } from "../local/user/Profile/ModelSelection.ts"
import { Profile, ProfileName } from "../local/user/Profile/Profile.ts"
import * as Profiles from "../local/user/Profiles.ts"
import { AccountName } from "../local/user/Provider/AccountName.ts"
import { Credential } from "../local/user/Provider/Credential.ts"
import { ProviderAccount } from "../local/user/Provider/ProviderAccount.ts"
import { ProviderId } from "../local/user/Provider/ProviderId.ts"
import { UserConfigLock } from "../local/user/UserConfigLock.ts"
import { UserFileSecurity } from "../local/user/UserFileSecurity.ts"
import { UserPaths } from "../local/user/UserPaths.ts"

const account = (provider: ProviderId, key: string, name = "primary") =>
  ProviderAccount.make({
    id: AccountName.make(name),
    provider,
    method: "api-key",
    credential: Credential.cases.ApiKey.make({ apiKey: Redacted.make(key) })
  })

const runtime = UserFileSecurity.layer.pipe(Layer.provideMerge(NodeServices.layer))
const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-account-save-" })
  const paths = UserPaths.of({
    workspaceKey: root,
    dataDirectory: path.join(root, "data"),
    config: path.join(root, "config", "profiles.json"),
    accounts: path.join(root, "data", "credentials.json"),
    lock: path.join(root, "data", "cli.lock")
  })
  const original = account("openai", "fake-original-key")
  yield* Accounts.write([original]).pipe(Effect.provideService(UserPaths, paths))
  const withLock = yield* UserConfigLock.make.pipe(Effect.provideService(UserPaths, paths))
  return { original, paths, withLock }
})

it.live(
  "rejects changing an account's provider without writing credentials",
  Effect.fnUntraced(function* () {
    const { original, paths, withLock } = yield* fixture
    const fs = yield* FileSystem.FileSystem
    const before = yield* fs.readFileString(paths.accounts)
    yield* Effect.gen(function* () {
      const error = yield* Accounts.save(account("openrouter", "fake-new-key")).pipe(Effect.flip)
      expect(error).toBeInstanceOf(Accounts.AccountProviderConflictError)
      const saved = yield* Accounts.read
      expect(saved).toEqual([original])
      const after = yield* fs.readFileString(paths.accounts)
      expect(after).toBe(before)
    }).pipe(Effect.provideService(UserPaths, paths), Effect.provideService(UserConfigLock, withLock))
  }, Effect.provide(runtime)),
  60000
)

it.live(
  "manages profiles and prevents removing referenced credentials through the library API",
  () =>
    Effect.gen(function* () {
      const { paths, withLock } = yield* fixture
      yield* Effect.gen(function* () {
        const name = ProfileName.make("work")
        const selection = ModelSelection.cases.Provider.make({ account: AccountName.make("primary"), model: "test" })
        const profile = Profile.make({ language: selection, decision: selection })
        yield* Profiles.save(name, profile)
        const duplicate = yield* Profiles.save(name, profile).pipe(Effect.flip)
        expect(duplicate).toBeInstanceOf(Profiles.ProfileOperationError)
        yield* Profiles.use(name)
        expect((yield* Profiles.get()).name).toBe(name)
        const referenced = yield* Accounts.remove(AccountName.make("primary")).pipe(Effect.flip)
        expect(referenced).toBeInstanceOf(Accounts.AccountRemovalError)
        const protectedProfile = yield* Profiles.remove(name).pipe(Effect.flip)
        expect(protectedProfile).toBeInstanceOf(Profiles.ProfileOperationError)
        const summaries = yield* Accounts.list
        expect(summaries).toEqual([{ id: "primary", provider: "openai", method: "api-key", credentialType: "ApiKey" }])
        expect(JSON.stringify(summaries)).not.toContain("fake-original-key")
        yield* Profiles.remove(name, { force: true })
        yield* Accounts.remove(AccountName.make("primary"))
        const remainingProfiles = yield* Profiles.list
        const remainingAccounts = yield* Accounts.list
        expect(remainingProfiles).toEqual([])
        expect(remainingAccounts).toEqual([])
      }).pipe(Effect.provideService(UserPaths, paths), Effect.provideService(UserConfigLock, withLock))
    }).pipe(Effect.scoped, Effect.provide(runtime)),
  60000
)

it.live(
  "rejects profiles referencing missing accounts without saving them",
  () =>
    Effect.gen(function* () {
      const { paths, withLock } = yield* fixture
      yield* Effect.gen(function* () {
        const selection = ModelSelection.cases.Provider.make({ account: AccountName.make("missing"), model: "test" })
        const result = yield* Profiles.save(
          ProfileName.make("work"),
          Profile.make({ language: selection, decision: selection })
        ).pipe(Effect.flip)
        expect(result).toBeInstanceOf(Profiles.ProfileOperationError)
        const saved = yield* Profiles.list
        expect(saved).toEqual([])
      }).pipe(Effect.provideService(UserPaths, paths), Effect.provideService(UserConfigLock, withLock))
    }).pipe(Effect.scoped, Effect.provide(runtime)),
  60000
)

it.live(
  "updates the same provider's key and permits a different provider under a new name",
  Effect.fnUntraced(function* () {
    const { paths, withLock } = yield* fixture
    const updated = account("openai", "fake-updated-key")
    const separate = account("openrouter", "fake-other-key", "router")
    yield* Effect.gen(function* () {
      yield* Accounts.save(updated)
      yield* Accounts.save(separate)
      const saved = yield* Accounts.read
      expect(saved).toEqual([updated, separate])
      expect(
        Array.map(saved, (entry) =>
          Credential.guards.ApiKey(entry.credential) ? Redacted.value(entry.credential.apiKey) : undefined
        )
      ).toEqual(["fake-updated-key", "fake-other-key"])
    }).pipe(Effect.provideService(UserPaths, paths), Effect.provideService(UserConfigLock, withLock))
  }, Effect.provide(runtime)),
  60000
)
