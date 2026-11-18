import { Context, Effect, Path, Schema as S } from "effect"

import * as ExtensionRuntime from "../ExtensionRuntime.ts"
import type { WorkspacePath } from "../util/WorkspacePath.ts"
import * as ExtensionModule from "./ExtensionModule.ts"
import { HostServices } from "./HostServices.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** Shares program-scoped setup outcomes and provides isolated execution resources; modules load from the workspace root. */
export const make = Effect.fnUntraced(function* <A, E, E2>(
  result: S.ConstraintDecoder<A>,
  error: S.Constraint & { readonly Type: E },
  executionError: S.Constraint & { readonly Type: E2 }
) {
  const { directory } = yield* WorkspaceRoot
  const path = yield* Path.Path
  const services = yield* Effect.context<HostServices>().pipe(Effect.map(Context.pick(...HostServices)))
  return yield* ExtensionRuntime.make(
    Effect.fnUntraced(function* (module: WorkspacePath) {
      const url = yield* path.toFileUrl(path.join(directory, module)).pipe(Effect.orDie)
      return yield* ExtensionModule.load(url, result, error)
    }),
    executionError,
    services
  )
})
