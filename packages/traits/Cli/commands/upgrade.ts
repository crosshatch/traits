import { Array, Console, Effect, FileSystem, Path, pipe, Schema as S, SemVer, String } from "effect"
import { CliError, Command } from "effect/cli"
import { Digest } from "effect/crypto"
import { HttpClient, HttpClientResponse } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import PackageJson from "../../package.json" with { type: "json" }
import { Executable } from "../../util/Executable.ts"

const latestRelease = "https://api.github.com/repos/crosshatch/traits/releases/latest"

/** The platforms the release workflow publishes a `traits-<target>.tar.gz` executable for. */
const targets = ["darwin-arm64", "linux-arm64", "linux-x64"]

const Release = S.Struct({
  /** The release's Git tag, traits@<version>. */
  tag_name: S.TemplateLiteralParser(["traits@", S.SemVerFromString]),
  assets: S.Array(S.Struct({ name: S.String, browser_download_url: S.String }))
})

const download = (url: string) =>
  HttpClient.get(url, { headers: { "user-agent": `traits/${PackageJson.version}` } }).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk)
  )

export const upgrade = Command.make(
  "upgrade",
  {},
  Effect.fn("upgrade")(function* () {
    const current = yield* Executable
    if (!current.standalone) {
      return yield* CliError.UserError.make({
        cause:
          "traits upgrade replaces the standalone executable, but this copy runs on Node.js. Upgrade it with your package manager, such as: npm install traits@latest"
      })
    }
    const target = current.target
    if (!Array.contains(targets, target)) {
      return yield* CliError.UserError.make({
        cause: `traits upgrade does not support ${target}. Download a release from https://github.com/crosshatch/traits/releases/latest`
      })
    }
    const executable = current.path
    const installed = SemVer.parseUnsafe(current.version)

    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const digest = yield* Digest.Digest
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

    const release = yield* download(latestRelease).pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Release)),
      Effect.mapError((cause) =>
        CliError.UserError.make({ cause: `Could not read the latest traits release from GitHub: ${cause.message}` })
      )
    )
    const latest = release.tag_name[1]
    if (!SemVer.isGreaterThan(latest, installed)) {
      return yield* Console.log(`traits ${current.version} is up to date.`)
    }

    const tag = `traits@${SemVer.format(latest)}`
    const archive = `traits-${target}.tar.gz`
    const asset = (name: string) =>
      pipe(
        release.assets,
        Array.findFirst((candidate) => candidate.name === name),
        Effect.fromOption,
        Effect.mapError(() => CliError.UserError.make({ cause: `The latest release, ${tag}, has no ${name}.` })),
        Effect.flatMap((found) => download(found.browser_download_url))
      )
    const [bytes, checksums] = yield* Effect.all(
      [
        asset(archive).pipe(
          Effect.flatMap((response) => response.arrayBuffer),
          Effect.map((buffer) => new Uint8Array(buffer))
        ),
        asset("checksums.txt").pipe(Effect.flatMap((response) => response.text))
      ],
      { concurrency: 2 }
    ).pipe(
      Effect.catchTag("HttpClientError", (cause) =>
        CliError.UserError.make({ cause: `Could not download ${tag}: ${cause.message}` })
      )
    )

    const expected = yield* pipe(
      checksums,
      String.split("\n"),
      Array.map((line) => pipe(line, String.trim, String.split(/\s+/))),
      Array.findFirst((columns) => columns[1] === archive),
      Effect.fromOption,
      Effect.mapBoth({
        onSuccess: (columns) => columns[0],
        onFailure: () => CliError.UserError.make({ cause: `checksums.txt has no entry for ${archive}.` })
      })
    )
    const actual = yield* digest.digestHex(Digest.sha256, bytes)
    if (actual !== expected) {
      return yield* CliError.UserError.make({ cause: `The checksum of ${archive} does not match checksums.txt.` })
    }

    yield* Effect.gen(function* () {
      // Unpacked beside the executable so the final rename stays on one file system and is atomic.
      const directory = yield* fs.makeTempDirectoryScoped({
        directory: path.dirname(executable),
        prefix: ".traits-upgrade-"
      })
      yield* fs.writeFile(path.join(directory, archive), bytes)
      const exitCode = yield* spawner.exitCode(
        ChildProcess.make`tar -xzf ${path.join(directory, archive)} -C ${directory}`
      )
      if (exitCode !== 0) {
        return yield* CliError.UserError.make({
          cause: `Could not unpack ${archive}: tar exited with code ${exitCode}.`
        })
      }
      yield* fs.chmod(path.join(directory, "traits"), 0o755)
      // Renaming over the file, rather than writing into it, leaves the running executable intact.
      return yield* fs.rename(path.join(directory, "traits"), executable)
    }).pipe(
      Effect.catchReason(
        "PlatformError",
        "PermissionDenied",
        () =>
          CliError.UserError.make({
            cause: `Could not replace ${executable}: permission denied. Run traits upgrade as a user who can write to ${path.dirname(executable)}.`
          }),
        (_, cause) => CliError.UserError.make({ cause: `Could not replace ${executable}: ${cause.message}` })
      )
    )

    yield* Console.log(`Upgraded traits ${current.version} to ${SemVer.format(latest)}.`)
  }, Effect.scoped)
).pipe(Command.withDescription("Replace this traits executable with the latest release from GitHub."))
