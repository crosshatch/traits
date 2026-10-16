import { Context, Effect, Layer, type Schema as S } from "effect"

import { query } from "./client.ts"
import type { Operation, Query } from "./contracts.ts"

export interface QueriesService {
  readonly query: (
    operation: Operation,
    input: Query
  ) => Effect.Effect<S.JsonObject, Effect.Error<ReturnType<typeof query>>, Effect.Services<ReturnType<typeof query>>>
}

export class Queries extends Context.Service<Queries, QueriesService>()("tracewick/Queries") {}

export const layer = (directory: string = ".") =>
  Layer.succeed(Queries, {
    query: (operation: Operation, input: Query) => query(operation, input, directory)
  } satisfies QueriesService)
