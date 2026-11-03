import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import * as Selection from "../Cli/Profile/ModelSelection.ts"
import * as LayerModule from "../LayerModule.ts"

it.effect(
  "round-trips provider and custom model selections and rejects untagged selections",
  Effect.fnUntraced(function* () {
    for (const selection of [
      { _tag: "Provider", account: "openai-work", model: "org/model" },
      { _tag: "Custom", path: "/models/language.ts" }
    ]) {
      const decoded = yield* pipe(selection, S.decodeUnknownEffect(Selection.ModelSelection))
      const encoded = yield* pipe(decoded, S.encodeEffect(Selection.ModelSelection))
      expect(encoded).toEqual(selection)
    }
    const invalid = yield* pipe(
      { account: "openai-work", model: "org/model" },
      S.decodeUnknownEffect(Selection.ModelSelection),
      Effect.flip
    )
    expect(invalid._tag).toBe("SchemaError")
  })
)

it.live(
  "imports a TypeScript module's default Layer using a correctly escaped file URL",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-custom-layer-" })
    const filename = path.join(root, "custom layer #1.ts")
    const source = String.stripMargin(`
    |import { Layer } from ${JSON.stringify(import.meta.resolve("effect"))};
    |const label: string = "custom";
    |export default Layer.empty;
    `)
    yield* fs.writeFileString(filename, source)
    const script = String.stripMargin(`
    |import { NodeServices } from ${JSON.stringify(import.meta.resolve("@effect/platform-node"))};
    |import { Effect, Layer } from ${JSON.stringify(import.meta.resolve("effect"))};
    |import { load } from ${JSON.stringify(new URL("../LayerModule.ts", import.meta.url).href)};
    |const layer = await Effect.runPromise(load(process.env.TRAITS_TEST_CUSTOM_LAYER).pipe(Effect.provide(NodeServices.layer)));
    |if (!Layer.isLayer(layer)) { throw new Error("Expected an Effect Layer"); }
    `)
    const exit = yield* ChildProcess.make(process.execPath, ["--input-type=module", "-e", script], {
      env: { TRAITS_TEST_CUSTOM_LAYER: filename },
      extendEnv: true,
      stderr: "inherit"
    }).pipe(spawner.exitCode)
    expect(exit).toBe(0)
  }, Effect.provide(NodeServices.layer))
)

it.live(
  "rejects missing modules and invalid default exports without retaining exported secrets",
  Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-invalid-layer-" })
    const filename = path.join(root, "invalid.ts")
    yield* fs.writeFileString(filename, 'export default { apiKey: "DO_NOT_RETAIN_EXPORTED_SECRET" };')
    const invalid = yield* LayerModule.load(filename).pipe(Effect.flip)
    expect(invalid).toBeInstanceOf(LayerModule.LayerModuleLoadError)
    expect(invalid.path).toBe(filename)
    expect(invalid.cause).toBeUndefined()
    const missing = yield* LayerModule.load(path.join(root, "missing.ts")).pipe(Effect.flip)
    expect(missing).toBeInstanceOf(LayerModule.LayerModuleLoadError)
  }, Effect.provide(NodeServices.layer))
)
