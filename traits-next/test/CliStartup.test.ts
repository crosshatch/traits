import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, pipe, Schema as S, Stream, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { Profile } from "../Cli/Profile/Profile.ts"
import { ProfileName } from "../Cli/Profile/ProfileName.ts"
import * as UserConfig from "../Cli/UserConfig.ts"

const runCli = Effect.fn("test.runCli")(function* (
  args: ReadonlyArray<string>,
  env: Record<string, string>,
  blockNativeLock: boolean = false,
  cwd?: string
) {
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner.spawn(
    ChildProcess.make(
      process.execPath,
      [
        ...(blockNativeLock ? ["--import", nativeLockFailureHook] : []),
        path.resolve(import.meta.dirname, "..", "main.ts"),
        ...args
      ],
      { env, extendEnv: true, stdin: "ignore", cwd: cwd ?? path.resolve() }
    )
  )
  return yield* Effect.all(
    {
      code: handle.exitCode,
      stdout: handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
      stderr: handle.stderr.pipe(Stream.decodeText(), Stream.mkString)
    },
    { concurrency: "unbounded" }
  )
})

it.live(
  "renders help and version without user directories, Windows configuration, or the native lock addon",
  Effect.fnUntraced(function* () {
    const env = {
      HOME: "",
      USERPROFILE: "",
      APPDATA: "",
      LOCALAPPDATA: "",
      SystemRoot: "",
      XDG_CONFIG_HOME: "",
      XDG_DATA_HOME: ""
    }
    for (const args of [
      ["--help"],
      ["--version"],
      ["auth", "--help"],
      ["auth", "login", "openai", "--help"],
      ["profile", "create", "--help"]
    ]) {
      const result = yield* runCli(args, env, true)
      expect(result.code).toBe(0)
      expect(String.trim(result.stdout).length).toBeGreaterThan(0)
      expect(result.stderr).not.toContain("TEST_NATIVE_LOCK_UNAVAILABLE")
    }
  }, Effect.provide(NodeServices.layer)),
  60000
)

it.live(
  "only loads the native lock addon when a command acquires the lock",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-cli-startup-" })
    const env = {
      HOME: root,
      USERPROFILE: root,
      APPDATA: path.join(root, "config"),
      LOCALAPPDATA: path.join(root, "data"),
      XDG_CONFIG_HOME: path.join(root, "config"),
      XDG_DATA_HOME: path.join(root, "data"),
      TRAITS_TEST_KEY: "fake-startup-key"
    }
    for (const args of [
      ["auth", "list"],
      ["auth", "status"],
      ["profile", "list"]
    ]) {
      const result = yield* runCli(args, env, true)
      expect(result.code).toBe(0)
    }
    const write = yield* runCli(["auth", "login", "openai", "--key-env", "TRAITS_TEST_KEY"], env, true)
    expect(write.code).not.toBe(0)
    expect(write.stdout + write.stderr).toContain("TEST_NATIVE_LOCK_UNAVAILABLE")
    expect(write.stdout + write.stderr).not.toContain(env.TRAITS_TEST_KEY)
  }, Effect.provide(NodeServices.layer)),
  60000
)

it.live(
  "renders storage and key-environment failures without stacks or credential contents",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-cli-errors-" })
    const env = {
      XDG_CONFIG_HOME: path.join(root, "config"),
      XDG_DATA_HOME: path.join(root, "data"),
      TRAITS_TEST_MISSING_KEY: "",
      TRAITS_TEST_BLANK_KEY: "   "
    }
    const configDirectory = path.join(env.XDG_CONFIG_HOME, "traits")
    const dataDirectory = path.join(env.XDG_DATA_HOME, "traits")
    yield* fs.makeDirectory(configDirectory, { recursive: true })
    yield* fs.makeDirectory(dataDirectory, { recursive: true })
    yield* fs.writeFileString(path.join(configDirectory, "profiles.json"), "{broken")
    yield* fs.writeFileString(path.join(dataDirectory, "credentials.json"), '{"apiKey":"DO_NOT_PRINT_TEST_SECRET"}')
    for (const args of [
      ["profile", "list"],
      ["auth", "list"],
      ["auth", "login", "openai", "--key-env", "TRAITS_TEST_MISSING_KEY"],
      ["auth", "login", "openai", "--key-env", "TRAITS_TEST_BLANK_KEY"]
    ]) {
      const result = yield* runCli(args, env)
      const output = result.stdout + result.stderr
      expect(result.code).not.toBe(0)
      expect(output).not.toContain("\n    at ")
      expect(output).not.toContain("SchemaError")
      expect(output).not.toContain("DO_NOT_PRINT_TEST_SECRET")
      if (args[0] === "profile") {
        expect(output).toContain("Could not read profiles")
        expect(output).toContain("profiles.json")
      } else if (args[1] === "list") {
        expect(output).toContain("Could not read provider accounts")
        expect(output).toContain("credentials.json")
      } else if (args[4] === "TRAITS_TEST_MISSING_KEY") {
        expect(output).toContain("TRAITS_TEST_MISSING_KEY")
      } else {
        expect(output).toContain("An API key is required")
      }
    }
  }, Effect.provide(NodeServices.layer)),
  60000
)

it.live(
  "stores custom layer paths without reading credentials or executing the modules",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-custom-profile-" })
    const env = { XDG_CONFIG_HOME: path.join(root, "config"), XDG_DATA_HOME: path.join(root, "data") }
    const module = path.join(root, "custom layer.ts")
    yield* fs.writeFileString(
      module,
      'throw new Error("PROFILE_MANAGEMENT_MUST_NOT_IMPORT_THIS"); export default undefined;'
    )
    const data = path.join(env.XDG_DATA_HOME, "traits")
    yield* fs.makeDirectory(data, { recursive: true })
    yield* fs.writeFileString(path.join(data, "credentials.json"), "not valid JSON")
    const created = yield* runCli(
      ["profile", "create", "custom", "--language", module, "--embedding", module, "--decision", module],
      env
    )
    expect(created.code).toBe(0)
    const shown = yield* runCli(["profile", "show", "custom"], env)
    expect(shown.code).toBe(0)
    const saved = yield* pipe(shown.stdout, S.decodeEffect(S.fromJsonString(S.Struct({ profile: Profile }))))
    for (const selection of [saved.profile.language, saved.profile.embedding, saved.profile.decision]) {
      expect(selection).toEqual({ _tag: "Custom", path: module })
    }
    const removed = yield* runCli(["profile", "remove", "custom"], env)
    expect(removed.code).toBe(0)
  }, Effect.provide(NodeServices.layer)),
  60000
)

it.live(
  "resolves workspace overrides and a profile named default without a separate default reference",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-workspace-profiles-" })
    const projectA = path.join(root, "project-a")
    const projectB = path.join(root, "project-b")
    const nested = path.join(projectA, "src")
    yield* Effect.all(
      [
        fs.makeDirectory(path.join(projectA, "traits"), { recursive: true }),
        fs.makeDirectory(path.join(projectB, ".git"), { recursive: true }),
        fs.makeDirectory(nested, { recursive: true })
      ],
      { concurrency: "unbounded" }
    )
    const canonicalA = yield* fs.realPath(projectA)
    const env = { XDG_CONFIG_HOME: path.join(root, "config"), XDG_DATA_HOME: path.join(root, "data") }
    const module = path.join(root, "layer.ts")
    yield* fs.writeFileString(module, "export default undefined;")
    const modelFlags = ["--language", module, "--embedding", module, "--decision", module]
    for (const name of ["default", "work"]) {
      const created = yield* runCli(["profile", "create", name, ...modelFlags], env, false, projectA)
      expect(created.code).toBe(0)
    }
    const configPath = path.join(env.XDG_CONFIG_HOME, "traits", "profiles.json")
    const fallback = yield* runCli(["profile", "show"], env, false, projectB)
    expect(fallback.code).toBe(0)
    expect(fallback.stdout).toContain('"name": "default"')
    const workspace = yield* runCli(["profile", "use", "work"], env, false, nested)
    expect(workspace.code, workspace.stdout + workspace.stderr).toBe(0)
    for (const cwd of [projectA, nested]) {
      const shown = yield* runCli(["profile", "show"], env, false, cwd)
      expect(shown.stdout).toContain('"name": "work"')
    }
    const other = yield* runCli(["profile", "show"], env, false, projectB)
    expect(other.stdout).toContain('"name": "default"')
    const explicit = yield* runCli(["profile", "show", "default"], env, false, projectA)
    expect(explicit.stdout).toContain('"name": "default"')
    const listed = yield* runCli(["profile", "list"], env, false, nested)
    expect(listed.stdout).toContain("* work")
    const reset = yield* runCli(["profile", "use", "default"], env, false, projectA)
    expect(reset.code).toBe(0)
    const resetConfig = yield* fs
      .readFileString(configPath)
      .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(UserConfig.UserConfig))))
    expect(resetConfig.workspaceProfiles).toEqual({})
    const resetSelection = yield* runCli(["profile", "show"], env, false, nested)
    expect(resetSelection.stdout).toContain('"name": "default"')
    const removedFlag = yield* runCli(["profile", "use", "work", "--default"], env, false, projectB)
    expect(removedFlag.code).not.toBe(0)
    const selectedAgain = yield* runCli(["profile", "use", "work"], env, false, nested)
    expect(selectedAgain.code).toBe(0)
    for (const name of ["default", "work"]) {
      const rejected = yield* runCli(["profile", "remove", name], env, false, projectB)
      expect(rejected.code).not.toBe(0)
      expect(rejected.stdout + rejected.stderr).toContain("--force")
    }
    const removed = yield* runCli(["profile", "remove", "work", "--force"], env, false, projectB)
    expect(removed.code).toBe(0)
    const storedText = yield* fs.readFileString(configPath)
    expect(storedText).not.toContain('"defaultProfile"')
    expect(storedText).not.toContain('"activeProfile"')
    const stored = yield* pipe(storedText, S.decodeEffect(S.fromJsonString(UserConfig.UserConfig)))
    expect(stored.workspaceProfiles).toEqual({})
    const broken = UserConfig.UserConfig.make({
      ...stored,
      workspaceProfiles: { [canonicalA]: ProfileName.make("missing") }
    })
    const brokenText = yield* pipe(broken, S.encodeEffect(S.fromJsonString(UserConfig.UserConfig)))
    yield* fs.writeFileString(configPath, brokenText)
    const dangling = yield* runCli(["profile", "show"], env, false, nested)
    expect(dangling.code).not.toBe(0)
    expect(dangling.stdout + dangling.stderr).toContain("missing")
    const explicitAfterDangling = yield* runCli(["profile", "show", "default"], env, false, nested)
    expect(explicitAfterDangling.code).toBe(0)
    const removedDefault = yield* runCli(["profile", "remove", "default", "--force"], env, false, projectB)
    expect(removedDefault.code).toBe(0)
    const noFallback = yield* runCli(["profile", "show"], env, false, projectB)
    expect(noFallback.code).not.toBe(0)
    expect(noFallback.stdout + noFallback.stderr).toContain("default")
  }, Effect.provide(NodeServices.layer)),
  180000
)

const nativeLockFailureScript = String.stripMargin(`
|import { registerHooks } from "node:module";
|registerHooks({
|  resolve: (specifier, context, next) => {
|    if (specifier === "fs-native-extensions") {
|      throw new Error("TEST_NATIVE_LOCK_UNAVAILABLE");
|    }
|    return next(specifier, context);
|  }
|});
`)
const nativeLockFailureHook = `data:text/javascript,${encodeURIComponent(nativeLockFailureScript)}`
