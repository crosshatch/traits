import { Array, Console, Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"
import { Argument, Command, Flag } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import * as Updates from "../Updates.ts"

class UpdateError extends S.TaggedError<UpdateError>()("UpdateError", { details: S.String }) {
  override get message() {
    return `Traits update incomplete. Inspect the installation before retrying: ${this.details}`
  }
}

export const install = Effect.fn("update.install")(function* (options: {
  readonly target: string
  readonly manager: "npm" | "pnpm" | "yarn"
  readonly skills: ReadonlyArray<string>
}) {
  yield* S.decodeEffect(Updates.Version)(options.target)
  yield* S.decodeEffect(S.SemVerFromString)(options.target)
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const cwd = path.resolve()
  const manifest = yield* fs.readFileString(path.join(cwd, "package.json")).pipe(
    Effect.flatMap(
      S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            packageManager: S.String.pipe(S.optional),
            dependencies: S.Record(S.String, S.String).pipe(S.optional),
            devDependencies: S.Record(S.String, S.String).pipe(S.optional)
          })
        )
      )
    )
  )
  if (
    manifest.packageManager !== undefined &&
    !pipe(manifest.packageManager, String.startsWith(`${options.manager}@`))
  ) {
    return yield* UpdateError.make({ details: "--manager must match package.json#packageManager." })
  }
  yield* Effect.filter(
    [
      ["npm", "package-lock.json"],
      ["npm", "npm-shrinkwrap.json"],
      ["pnpm", "pnpm-lock.yaml"],
      ["yarn", "yarn.lock"]
    ] as const,
    (lock) => fs.exists(path.join(cwd, lock[1]))
  ).pipe(
    Effect.filterOrFail(
      (locks) => Array.every(locks, (lock) => lock[0] === options.manager),
      () => UpdateError.make({ details: "Conflicting lockfiles: use the installation's owning package manager." })
    )
  )
  const dependency = manifest.dependencies?.traits
  const devDependency = manifest.devDependencies?.traits
  const specifier = dependency ?? devDependency
  if (
    specifier === undefined ||
    (dependency !== undefined && devDependency !== undefined) ||
    !/^[~^]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(specifier)
  ) {
    return yield* UpdateError.make({
      details:
        "Run from the package declaring Traits as a regular version dependency. Update global, runner, workspace, catalog, linked, or complex-range installations through their owning mechanism, then synchronize their skills."
    })
  }
  const packageRoot = path.join(cwd, "node_modules", "traits")
  const bundledPath = path.join(packageRoot, "skills", "traits", "SKILL.md")
  const original = yield* fs.readFileString(bundledPath)
  const bundledRealPath = yield* fs.realPath(bundledPath)
  const skills = Array.dedupe(Array.map(options.skills, (file) => path.resolve(file)))
  if (skills.length === 0) {
    return yield* UpdateError.make({
      details: "List every active Traits SKILL.md destination so the server and skill update together."
    })
  }
  const destinations = yield* Effect.forEach(
    skills,
    Effect.fn("update.preflightSkill")(function* (file) {
      if (file === bundledPath || path.basename(file) !== "SKILL.md") {
        return yield* UpdateError.make({
          details: `Expected an installed skill destination, not the package source: ${file}`
        })
      }
      const realPath = yield* fs.realPath(file)
      const linked = realPath === bundledRealPath
      yield* fs.readFileString(file).pipe(
        Effect.filterOrFail(
          (content) => content === original,
          () =>
            UpdateError.make({
              details: `Customized or stale skill at ${file}. Reconcile it with the installed bundled skill before updating; no packages have been changed.`
            })
        )
      )
      return { file, realPath, linked }
    })
  )
  const workspaceRoot = options.manager === "pnpm" && (yield* fs.exists(path.join(cwd, "pnpm-workspace.yaml")))
  const prefix = specifier[0] === "^" || specifier[0] === "~" ? specifier[0] : ""
  const rangeFlags = prefix === "" ? ["--save-exact"] : ["--save-exact=false", `--save-prefix=${prefix}`]
  const args =
    options.manager === "npm"
      ? [
          "install",
          ...rangeFlags,
          devDependency === undefined ? "--save-prod" : "--save-dev",
          `traits@${options.target}`
        ]
      : options.manager === "pnpm"
        ? [
            "add",
            ...rangeFlags,
            devDependency === undefined ? "--save-prod" : "--save-dev",
            ...(workspaceRoot ? ["--workspace-root"] : []),
            `traits@${options.target}`
          ]
        : [
            "add",
            prefix === "" ? "--exact" : prefix === "~" ? "--tilde" : "--caret",
            ...(devDependency === undefined ? [] : ["--dev"]),
            `traits@${options.target}`
          ]
  yield* Console.log(
    `Updating Traits to ${options.target} with ${options.manager}; synchronizing ${skills.length} skill destination(s).`
  )
  yield* spawner
    .exitCode(
      ChildProcess.make(options.manager, args, {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit"
      })
    )
    .pipe(
      Effect.filterOrFail(
        (exitCode) => exitCode === 0,
        (exitCode) =>
          UpdateError.make({
            details: `Package manager exited with ${exitCode}. Skills were not synchronized; package files may have changed.`
          })
      )
    )
  yield* fs.readFileString(path.join(packageRoot, "package.json")).pipe(
    Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Struct({ version: S.String })))),
    Effect.filterOrFail(
      (installed) => installed.version === options.target,
      (installed) =>
        UpdateError.make({
          details: `Expected ${options.target}, found ${installed.version}; skills were not synchronized.`
        })
    )
  )
  const updated = yield* fs.readFileString(bundledPath)
  yield* Effect.forEach(
    destinations,
    Effect.fn("update.synchronizeSkill")(function* (destination) {
      const { file, realPath, linked } = destination
      const content = yield* fs.readFileString(file)
      if (content === updated) return
      if (linked || content !== original || (yield* fs.realPath(file)) !== realPath) {
        return yield* UpdateError.make({
          details: `Server package updated, but skill ${file} changed or its link is stale. Reconcile it with ${bundledPath} before restarting.`
        })
      }
      const temporary = yield* fs.makeTempFileScoped({ directory: path.dirname(realPath), prefix: ".traits-skill-" })
      yield* fs.writeFileString(temporary, updated)
      yield* fs.rename(temporary, realPath)
      yield* fs.readFileString(file).pipe(
        Effect.filterOrFail(
          (verified) => verified === updated,
          () => UpdateError.make({ details: `Server package updated, but skill verification failed: ${file}` })
        )
      )
    })
  )
  yield* Console.log(
    String.stripMargin(`
  | Installed Traits ${options.target} and verified its skill destinations. The running server has not been restarted.
  | Reconnect through the MCP host after active calls finish, then verify serverInfo.version is ${options.target}.
  | Reload the skill or start a new conversation if the host cached it.
  `)
  )
}, Effect.scoped)

export const update = Command.make(
  "update",
  {
    target: Flag.String("target").pipe(
      Flag.withSchema(Updates.Version),
      Flag.withDescription("Exact stable version approved by the user")
    ),
    manager: Flag.Literals("manager", ["npm", "pnpm", "yarn"]),
    skills: Argument.String("skill").pipe(
      Argument.variadic(),
      Argument.withDescription("Every active Traits SKILL.md path (linked or unmodified snapshot)")
    )
  },
  install
).pipe(
  Command.withDescription(
    "Update a local Traits dependency and its installed skills after user approval; reconnect through the MCP host afterwards"
  )
)
