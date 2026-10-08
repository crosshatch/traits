import { Context, Layer, Semaphore } from "effect"

export class TraitsContext extends Context.Service<TraitsContext>()("traits/TraitsContext", {
  make: Semaphore.make(4)
}) {
  static readonly layer = Layer.effect(this, this.make)
}
