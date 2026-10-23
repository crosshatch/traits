#!/usr/bin/env node
// traits-ignore-file effect-utilities-with-native-behavior-exceptions: Effect utilities are unavailable until this launcher installs dependencies.
// traits-ignore-file effect-platform-services: Native Node APIs must install project dependencies before Effect platform services are available.
// traits-ignore-file effect-based-exception-handling: Dependency installation must finish before Effect error-handling APIs are available.
import { spawn, type SpawnOptions } from "node:child_process"
import { once } from "node:events"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const candidates = [
  ["pnpm", ["pnpm-lock.yaml"]],
  ["npm", ["package-lock.json", "npm-shrinkwrap.json"]],
  ["yarn", ["yarn.lock"]],
  ["bun", ["bun.lock", "bun.lockb"]]
] as const

const installCommand = (root: string): [string, string[]] => {
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  const declared =
    typeof manifest === "object" && manifest !== null && "packageManager" in manifest
      ? manifest.packageManager
      : undefined
  const matches = candidates.filter((candidate) => candidate[1].some((file) => existsSync(join(root, file))))
  const manager =
    typeof declared === "string" ? declared.split("@")[0] : matches.length === 1 ? matches[0]?.[0] : undefined
  if (manager === undefined || !candidates.some((candidate) => candidate[0] === manager)) {
    throw new Error("Set package.json#packageManager to pnpm, npm, yarn, or bun to select the installer")
  }
  const locked =
    candidates.find((candidate) => candidate[0] === manager)?.[1].some((file) => existsSync(join(root, file))) ?? false
  if (manager === "npm") return [manager, [locked ? "ci" : "install"]]
  if (manager === "yarn") {
    const modern =
      typeof declared === "string"
        ? !declared.startsWith("yarn@1.")
        : /^__metadata:/m.test(readFileSync(join(root, "yarn.lock"), "utf8"))
    return [manager, ["install", ...(locked ? [modern ? "--immutable" : "--frozen-lockfile"] : [])]]
  }
  return [manager, ["install", ...(locked ? ["--frozen-lockfile"] : [])]]
}

const execute = (command: string, args: string[], options: SpawnOptions) => {
  const child = spawn(command, args, options)
  const interrupt = () => {
    child.kill("SIGINT")
  }
  const terminate = () => {
    child.kill("SIGTERM")
  }
  const hangup = () => {
    child.kill("SIGHUP")
  }
  process.on("SIGINT", interrupt)
  process.on("SIGTERM", terminate)
  process.on("SIGHUP", hangup)
  return once(child, "close")
    .then((result) => result as [number | null, NodeJS.Signals | null])
    .finally(() => {
      process.off("SIGINT", interrupt)
      process.off("SIGTERM", terminate)
      process.off("SIGHUP", hangup)
    })
}

const [command, args] = installCommand(process.cwd())
process.stderr.write(`[traits] Installing dependencies in ${process.cwd()} using ${command}\n`)
const [installCode, installSignal] = await execute(command, args, {
  stdio: ["ignore", process.stderr, process.stderr]
})
if (installCode !== 0) throw new Error(`${command} exited with ${installSignal ?? installCode}`)

const main = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./main.ts" : "./main.js", import.meta.url))
const [exitCode, signal] = await execute(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("tracewick/cli")),
    "run",
    "--id",
    "traits",
    "--",
    process.execPath,
    main,
    ...process.argv.slice(2)
  ],
  { stdio: "inherit", detached: process.platform !== "win32" }
)
process.exitCode = exitCode ?? 1
if (signal !== null) process.kill(process.pid, signal)
