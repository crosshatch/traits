import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import {
  Cause,
  Context,
  DateTime,
  Deferred,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  Layer,
  Option,
  Path,
  Scope,
  Schema as S,
  String,
  Types
} from "effect"
import { Chat, DecisionModel, EmbeddingModel, LanguageModel } from "effect/ai"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore } from "effect/persistence"

import { check } from "../Check/Check.ts"
import { EnrichmentRegistry } from "../Enrichment/EnrichmentRegistry.ts"
import { ModuleSpecifier } from "../schema/index.ts"
import { SegmenterSetupError } from "../Segmenter/index.ts"
import { SegmenterRegistry } from "../Segmenter/SegmenterRegistry.ts"
import { Trait } from "../Trait.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"

class Probe extends Context.Service<
  Probe,
  Types.Mutable<{
    readonly setups: number
    readonly executions: number
    readonly setupClosed: number
    readonly executionsClosed: number
    readonly chats: Array<Chat.Chat>
    readonly scopes: Array<unknown>
    readonly fail: boolean
    readonly started: Effect.Effect<void>
    readonly gate: Effect.Effect<void>
  }>
>()("traits-next/test/ExtensionRegistry.test/Probe") {}

const host = Layer.mergeAll(
  NodeServices.layer,
  Layer.succeed(DateTime.CurrentTimeZone, DateTime.zoneMakeOffset(0)),
  Layer.mock(DecisionModel.DecisionModel, { [DecisionModel.TypeId]: DecisionModel.TypeId }),
  Layer.effect(
    EmbeddingModel.EmbeddingModel,
    EmbeddingModel.make({ embedMany: () => Effect.die("Unexpected embedding request") })
  ),
  Layer.mock(LanguageModel.LanguageModel, { [LanguageModel.TypeId]: LanguageModel.TypeId }),
  Layer.mock(Digest.Digest, {}),
  Layer.mock(SecureRandom.SecureRandom, {}),
  FetchHttpClient.layer,
  KeyValueStore.layerMemory
)

it.live("closes resources from interrupted setup when the registry shuts down", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const module = yield* fixture
      const state = probe()
      const started = yield* Deferred.make<void>()
      state.started = Deferred.succeed(started, undefined).pipe(Effect.asVoid)
      state.gate = Effect.never
      const parent = yield* Scope.Scope
      const registryScope = yield* Scope.fork(parent)
      const registry = yield* Layer.build(SegmenterRegistry.layer).pipe(
        Effect.map(Context.get(SegmenterRegistry)),
        Effect.provideService(Probe, state),
        Scope.provide(registryScope)
      )
      const waiting = yield* registry(module).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Scope.close(registryScope, Exit.void)
      const exit = yield* Fiber.await(waiting)
      expect(Exit.isFailure(exit)).toBe(true)
      expect(state.setupClosed).toBe(1)
    })
  ).pipe(Effect.provide(host))
)

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-extension-registry-" })
  const filename = path.join(directory, "segmenter.mjs")
  yield* fs.writeFileString(
    filename,
    String.stripMargin(`
  |import { Context, Effect, Scope } from ${JSON.stringify(import.meta.resolve("effect"))};
  |import { Chat } from ${JSON.stringify(import.meta.resolve("effect/ai"))};
  |import { SegmenterSetupError } from ${JSON.stringify(import.meta.resolve("../Segmenter/SegmenterSetupError.ts"))};
  |const Probe = Context.Service("traits-next/test/ExtensionRegistry.test/Probe");
  |export default Effect.gen(function* () {
  |  const probe = yield* Probe;
  |  probe.setups++;
  |  yield* Effect.addFinalizer(() => Effect.sync(() => { probe.setupClosed++; }));
  |  yield* probe.started;
  |  yield* probe.gate;
  |  if (probe.fail) {
  |    return yield* SegmenterSetupError.make({ instruction: "Restore the dependency and restart." });
  |  }
  |  return Effect.fnUntraced(function* () {
  |    probe.executions++;
  |    const chat = yield* Chat.Chat;
  |    const scope = yield* Scope.Scope;
  |    probe.chats.push(chat);
  |    probe.scopes.push(scope);
  |    yield* Effect.addFinalizer(() => Effect.sync(() => { probe.executionsClosed++; }));
  |    return [];
  |  });
  |});
  `)
  )
  const url = yield* path.toFileUrl(filename)
  return ModuleSpecifier.make(url.href)
})

const probe = () =>
  Probe.of({
    setups: 0,
    executions: 0,
    setupClosed: 0,
    executionsClosed: 0,
    chats: [],
    scopes: [],
    fail: false,
    started: Effect.void,
    gate: Effect.void
  })

it.live("shares setup while isolating execution chats/scopes and owning setup resources until shutdown", () =>
  Effect.gen(function* () {
    const state = probe()
    yield* Effect.scoped(
      Effect.gen(function* () {
        const module = yield* fixture
        const registry = yield* Layer.build(SegmenterRegistry.layer).pipe(Effect.map(Context.get(SegmenterRegistry)))
        const { one, two } = yield* Effect.all(
          { one: registry(module), two: registry(module) },
          { concurrency: "unbounded" }
        )
        expect(state.setups).toBe(1)
        yield* Effect.all(
          [one({ after: { path: "one.ts", text: "" } }), two({ after: { path: "two.ts", text: "" } })],
          { concurrency: "unbounded" }
        )
        expect(state.executions).toBe(2)
        expect(state.executionsClosed).toBe(2)
        expect(state.setupClosed).toBe(0)
        expect(state.chats[0]).not.toBe(state.chats[1])
        expect(state.scopes[0]).not.toBe(state.scopes[1])
        yield* registry(module)
        expect(state.setups).toBe(1)
        const request = {
          traits: [
            Trait.make({
              name: TraitName.make("example"),
              purpose: TraitPurpose.make("Protect correctness."),
              segment: module
            })
          ],
          changes: [{ after: { path: "file.ts", text: "" } }]
        }
        yield* check(request).pipe(
          Effect.provideService(SegmenterRegistry, registry),
          Effect.provide(EnrichmentRegistry.layer)
        )
        yield* check(request).pipe(
          Effect.provideService(SegmenterRegistry, registry),
          Effect.provide(EnrichmentRegistry.layer)
        )
        expect(state.setups).toBe(1)
        expect(state.executions).toBe(4)
      }).pipe(Effect.provideService(Probe, state))
    )
    expect(state.setupClosed).toBe(1)
  }).pipe(Effect.provide(host))
)

it.live("retains setup failures and does not cancel shared initialization when one waiter is interrupted", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const module = yield* fixture
      const state = probe()
      const started = yield* Deferred.make<void>()
      const gate = yield* Deferred.make<void>()
      state.started = Deferred.succeed(started, undefined).pipe(Effect.asVoid)
      state.gate = Deferred.await(gate)
      const registry = yield* Layer.build(SegmenterRegistry.layer).pipe(
        Effect.map(Context.get(SegmenterRegistry)),
        Effect.provideService(Probe, state)
      )
      const first = yield* registry(module).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Fiber.interrupt(first)
      yield* Deferred.succeed(gate, undefined)
      const execute = yield* registry(module)
      yield* execute({ after: { path: "file.ts", text: "" } })
      expect(state.setups).toBe(1)

      const failedModule = yield* fixture
      state.fail = true
      const firstFailure = yield* registry(failedModule).pipe(Effect.exit)
      expect(state.setupClosed).toBe(1)
      state.fail = false
      const repeatedFailure = yield* registry(failedModule).pipe(Effect.exit)
      expect(Exit.isFailure(firstFailure)).toBe(true)
      expect(Exit.isFailure(repeatedFailure)).toBe(true)
      if (Exit.isFailure(firstFailure) && Exit.isFailure(repeatedFailure)) {
        const original = Option.getOrUndefined(Cause.findErrorOption(firstFailure.cause))
        expect(original).toBeInstanceOf(SegmenterSetupError)
        expect(Option.getOrUndefined(Cause.findErrorOption(repeatedFailure.cause))).toBe(original)
      }
      expect(state.setups).toBe(2)
      expect(state.setupClosed).toBe(1)
    })
  ).pipe(Effect.provide(host))
)

it.live("reuses real enrichment setup while isolating input context, chats, and execution resources", () =>
  Effect.gen(function* () {
    const state = probe()
    yield* Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-enrichment-registry-" })
        const filename = path.join(directory, "enrichment.mjs")
        yield* fs.writeFileString(
          filename,
          String.stripMargin(`
      |import { Context, Effect, Scope } from ${JSON.stringify(import.meta.resolve("effect"))};
      |import { Chat } from ${JSON.stringify(import.meta.resolve("effect/ai"))};
      |import { EnrichmentContext } from ${JSON.stringify(import.meta.resolve("../Enrichment/EnrichmentContext.ts"))};
      |const Probe = Context.Service("traits-next/test/ExtensionRegistry.test/Probe");
      |export default Effect.gen(function* () {
      |  const probe = yield* Probe;
      |  probe.setups++;
      |  yield* Effect.addFinalizer(() => Effect.sync(() => { probe.setupClosed++; }));
      |  return Effect.gen(function* () {
      |    const context = yield* EnrichmentContext;
      |    probe.executions++;
      |    const chat = yield* Chat.Chat;
      |    const scope = yield* Scope.Scope;
      |    probe.chats.push(chat);
      |    probe.scopes.push(scope);
      |    yield* Effect.addFinalizer(() => Effect.sync(() => { probe.executionsClosed++; }));
       |    return context.input.change.after.path === "invalid.ts" ? { secret: "private-result" } : context.input.change.after.path;
      |  });
      |});
      `)
        )
        const url = yield* path.toFileUrl(filename)
        const module = ModuleSpecifier.make(url.href)
        const services = yield* Layer.build(Layer.merge(SegmenterRegistry.layer, EnrichmentRegistry.layer)).pipe(
          Effect.provideService(Probe, state)
        )
        for (const filename of ["one.ts", "two.ts"]) {
          const report = yield* check({
            traits: [
              Trait.make({
                name: TraitName.make("example"),
                purpose: TraitPurpose.make("Protect correctness."),
                enrichments: [module]
              })
            ],
            changes: [{ after: { path: filename, text: "" } }]
          }).pipe(Effect.provideContext(services))
          expect(report.traits[0]!.inputs[0]!.enrichments).toEqual([{ module, text: filename }])
          expect(report.traits[0]!.inputs[0]!.status).toBe("Completed")
        }
        const invalid = yield* check({
          traits: [
            Trait.make({
              name: TraitName.make("example"),
              purpose: TraitPurpose.make("Protect correctness."),
              enrichments: [module]
            })
          ],
          changes: [{ after: { path: "invalid.ts", text: "" } }]
        }).pipe(Effect.provideContext(services))
        expect(invalid.traits[0]!.inputs[0]!.enrichments).toEqual([])
        expect(invalid.diagnostics).toHaveLength(1)
        expect(JSON.stringify(invalid)).not.toContain("private-result")
        expect(state.setups).toBe(1)
        expect(state.executions).toBe(3)
        expect(state.executionsClosed).toBe(3)
        expect(state.setupClosed).toBe(0)
        expect(state.chats[0]).not.toBe(state.chats[1])
        expect(state.scopes[0]).not.toBe(state.scopes[1])
      })
    )
    expect(state.setupClosed).toBe(1)
  }).pipe(Effect.provide(host))
)

it.live("preserves module/setup validation errors while rejecting wrong-stage setup errors as defects", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-invalid-extension-" })
      const registry = yield* Layer.build(SegmenterRegistry.layer).pipe(Effect.map(Context.get(SegmenterRegistry)))
      const sources = [
        "export default {};",
        `import { Effect } from ${JSON.stringify(import.meta.resolve("effect"))}; export default Effect.succeed(null);`,
        `import { EnrichmentSetupError } from ${JSON.stringify(import.meta.resolve("../Enrichment/EnrichmentSetupError.ts"))}; export default EnrichmentSetupError.make({ instruction: "Restore the dependency." });`
      ]
      for (const [index, source] of sources.entries()) {
        const filename = path.join(directory, `${index}.mjs`)
        yield* fs.writeFileString(filename, source)
        const url = yield* path.toFileUrl(filename)
        const exit = yield* registry(ModuleSpecifier.make(url.href)).pipe(Effect.exit)
        expect(Exit.isFailure(exit)).toBe(true)
        if (Exit.isFailure(exit)) {
          expect(Cause.hasDies(exit.cause)).toBe(index === 2)
          expect(Cause.hasFails(exit.cause)).toBe(index !== 2)
          if (index !== 2) {
            expect(S.isSchemaError(Option.getOrUndefined(Cause.findErrorOption(exit.cause)))).toBe(true)
          }
        }
      }
    })
  ).pipe(Effect.provide(host))
)
