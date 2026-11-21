import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, Ref, SemVer } from "effect"
import { Digest } from "effect/crypto"
import { HttpClient, HttpClientResponse } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { upgradeExecutable } from "../Cli/upgrade.ts"

const latestRelease = "https://api.github.com/repos/crosshatch/traits/releases/latest"
const target = "linux-x64"
const archive = `traits-${target}.tar.gz`

/** An installed executable containing "old", and a GitHub stub whose latest release has the given tag and an archive that unpacks to "new". */
const setup = Effect.fn("setup")(function* (options: {
  readonly tag: string
  /** The checksum checksums.txt lists for the archive; the archive's real one when omitted. */
  readonly checksum?: string
  /** The asset names the release lists; the archive and checksums.txt when omitted. */
  readonly assets?: ReadonlyArray<string>
}) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const digest = yield* Digest.Digest
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  const directory = yield* fs.makeTempDirectoryScoped()
  const executable = path.join(directory, "bin", "traits")
  yield* fs.makeDirectory(path.join(directory, "bin"))
  yield* fs.writeFileString(executable, "old")
  yield* fs.makeDirectory(path.join(directory, "release"))
  yield* fs.writeFileString(path.join(directory, "release", "traits"), "new")
  yield* spawner.exitCode(
    ChildProcess.make`tar -czf ${path.join(directory, archive)} -C ${path.join(directory, "release")} traits`
  )
  const bytes = yield* fs.readFile(path.join(directory, archive))
  const checksum = options.checksum ?? (yield* digest.digestHex(Digest.sha256, bytes))
  const bodies: Record<string, Uint8Array | string> = {
    [`/${archive}`]: bytes,
    "/checksums.txt": `${checksum}  ${archive}\n`
  }
  const release = {
    tag_name: options.tag,
    assets: Array.map(options.assets ?? [archive, "checksums.txt"], (name) => ({
      name,
      browser_download_url: `https://downloads.test/${name}`
    }))
  }

  const requests = yield* Ref.make<ReadonlyArray<string>>([])
  const github = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) =>
      Ref.update(requests, Array.append(url.href)).pipe(
        Effect.as(
          HttpClientResponse.fromWeb(
            request,
            url.href === latestRelease
              ? Response.json(release)
              : new Response(bodies[url.pathname] ?? null, {
                  status: url.pathname in bodies ? 200 : 404
                })
          )
        )
      )
    )
  )
  return { executable, github, requests: Ref.get(requests) }
})

layer(Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto))((it) => {
  // The command only supports macOS and Linux, and these tests build their fixture with tar.
  const test = it.effect.skipIf(process.platform === "win32")

  test("replaces the executable with GitHub's latest release when it is newer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const { executable, github, requests } = yield* setup({ tag: "traits@2.0.0" })

      const result = yield* upgradeExecutable({ executable, installed: SemVer.parseUnsafe("1.0.0"), target }).pipe(
        Effect.provide(github)
      )

      const content = yield* fs.readFileString(executable)
      const info = yield* fs.stat(executable)
      const siblings = yield* fs.readDirectory(path.dirname(executable))
      const requested = yield* requests
      expect(result.upgraded).toBe(true)
      expect(SemVer.format(result.latest)).toBe("2.0.0")
      expect(content).toBe("new")
      expect(info.mode & 0o111).toBe(0o111)
      expect(siblings).toEqual(["traits"])
      expect(requested[0]).toBe(latestRelease)
    }))

  test("downloads nothing when the latest release is not newer", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const { executable, github, requests } = yield* setup({ tag: "traits@1.0.0" })

      const result = yield* upgradeExecutable({ executable, installed: SemVer.parseUnsafe("1.0.0"), target }).pipe(
        Effect.provide(github)
      )

      const content = yield* fs.readFileString(executable)
      const requested = yield* requests
      expect(result.upgraded).toBe(false)
      expect(content).toBe("old")
      expect(requested).toEqual([latestRelease])
    }))

  const failures = [
    {
      name: "the archive does not match its checksum",
      release: { tag: "traits@2.0.0", checksum: "not-the-archive-checksum" },
      message: "The checksum of traits-linux-x64.tar.gz does not match checksums.txt."
    },
    {
      name: "the release has no executable for the target",
      release: { tag: "traits@2.0.0", assets: ["checksums.txt"] },
      message: "The latest release, traits@2.0.0, has no traits-linux-x64.tar.gz."
    },
    {
      name: "the latest release belongs to another package",
      release: { tag: "@traits/typescript@2.0.0" },
      message: "Could not read the latest traits release from GitHub"
    }
  ]
  for (const { name, release, message } of failures) {
    test(`leaves the executable alone when ${name}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const { executable, github } = yield* setup(release)

        const error = yield* upgradeExecutable({ executable, installed: SemVer.parseUnsafe("1.0.0"), target }).pipe(
          Effect.provide(github),
          Effect.flip
        )

        const content = yield* fs.readFileString(executable)
        const siblings = yield* fs.readDirectory(path.dirname(executable))
        expect(error._tag).toBe("UserError")
        expect(error.cause).toContain(message)
        expect(content).toBe("old")
        expect(siblings).toEqual(["traits"])
      }))
  }
})
