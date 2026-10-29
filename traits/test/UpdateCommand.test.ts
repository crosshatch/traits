import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Result } from "effect"
import { ChildProcessSpawner } from "effect/process"

import * as Update from "../commands/update.ts"

it.effect(
  "updates snapshot and linked skills together, preserving links and refusing customizations before installation",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "traits-update-" })
    const packageRoot = path.join(cwd, "node_modules", "traits")
    const bundled = path.join(packageRoot, "skills", "traits", "SKILL.md")
    const snapshot = path.join(cwd, "snapshot", "SKILL.md")
    const snapshotLink = path.join(cwd, "snapshot-link", "SKILL.md")
    const linked = path.join(cwd, "linked", "SKILL.md")
    for (const file of [bundled, snapshot, snapshotLink, linked])
      yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(
      path.join(cwd, "package.json"),
      JSON.stringify({ packageManager: "npm@11.0.0", devDependencies: { traits: "^0.9.0" } })
    )
    yield* fs.writeFileString(path.join(packageRoot, "package.json"), JSON.stringify({ version: "0.9.0" }))
    yield* fs.writeFileString(bundled, "old skill")
    yield* fs.writeFileString(snapshot, "old skill")
    yield* fs.symlink(snapshot, snapshotLink)
    yield* fs.symlink(bundled, linked)
    let installs = 0
    const install = Update.install({ target: "0.10.0", manager: "npm", skills: [snapshotLink, linked] }).pipe(
      Effect.provideService(Path.Path, { ...path, resolve: (...paths) => path.resolve(cwd, ...paths) }),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
        ...spawner,
        exitCode: Effect.fnUntraced(function* (command) {
          installs++
          expect(command).toMatchObject({
            command: "npm",
            args: ["install", "--save-exact=false", "--save-prefix=^", "--save-dev", "traits@0.10.0"]
          })
          yield* fs.writeFileString(path.join(packageRoot, "package.json"), JSON.stringify({ version: "0.10.0" }))
          yield* fs.writeFileString(bundled, "new skill")
          return ChildProcessSpawner.ExitCode(0)
        })
      })
    )
    yield* install
    expect(installs).toBe(1)
    const snapshotContent = yield* fs.readFileString(snapshotLink)
    const linkedContent = yield* fs.readFileString(linked)
    expect(snapshotContent).toBe("new skill")
    expect(linkedContent).toBe("new skill")
    const snapshotTarget = yield* fs.realPath(snapshotLink)
    const snapshotPath = yield* fs.realPath(snapshot)
    const linkedTarget = yield* fs.realPath(linked)
    const bundledPath = yield* fs.realPath(bundled)
    expect(snapshotTarget).toBe(snapshotPath)
    expect(linkedTarget).toBe(bundledPath)
    yield* fs.writeFileString(snapshot, "custom skill")
    const refused = yield* install.pipe(Effect.result)
    expect(Result.isFailure(refused)).toBe(true)
    expect(installs).toBe(1)
    const preserved = yield* fs.readFileString(snapshot)
    expect(preserved).toBe("custom skill")
  }, Effect.provide(NodeServices.layer))
)
