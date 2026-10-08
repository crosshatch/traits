import { Context, Effect, Layer, Semaphore } from "effect"

export class TraitsContext extends Context.Service<TraitsContext>()("traits/TraitsContext", {
  make: Semaphore.make(4).pipe(Effect.map((semaphore) => ({ agentId: "local", semaphore })))
}) {
  static readonly layer = Layer.effect(this, this.make)
}
