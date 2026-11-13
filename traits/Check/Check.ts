import { Array, Effect, pipe, Schema as S } from "effect"
import type { Digest } from "effect/crypto"

import PackageJson from "../package.json" with { type: "json" }
import * as Report from "../Report/Report.ts"
import { type InputSource, TextDigest } from "../util/util.ts"
import { CheckInput } from "./CheckInput.ts"
import * as Evaluation from "./Evaluation.ts"
import * as Preparation from "./Preparation.ts"

export { CheckInput, CheckTrait } from "./CheckInput.ts"

const sourceIdentity = (source: InputSource) =>
  pipe(
    source.text,
    TextDigest.make,
    Effect.map((digest) => Report.SourceIdentity.make({ path: source.path, digest }))
  )

/** Simultaneous source digests; each holds an encoded copy of its source text. */
const digestConcurrency = 8

/** Evaluates changes against traits. Keep registry layers alive across calls to share setup; execution results belong to one check. Fails for an invalid request, before any extension or model work, or with the decision model's AiError when its provider rejects the account (credentials, permissions, or quota), since no further decision could succeed; other decision failures are recorded on their inputs. */
export const check = Effect.fn("Check.check")(function* (request: CheckInput) {
  const input = yield* pipe(request, S.decodeEffect(CheckInput))
  const preparation = yield* Preparation.make(input)
  const { models, usage, traits } = yield* Evaluation.evaluate(input, preparation)
  const changes = yield* Effect.forEach(
    input.changes,
    (change): Effect.Effect<Report.ChangeIdentity, never, Digest.Digest> =>
      change.after === undefined
        ? pipe(
            change.before!,
            sourceIdentity,
            Effect.map((before) => ({ before }))
          )
        : Effect.all(
            {
              after: sourceIdentity(change.after),
              ...(change.before === undefined ? {} : { before: sourceIdentity(change.before) })
            },
            { concurrency: "unbounded" }
          ),
    { concurrency: digestConcurrency }
  )
  return Report.Report.make({
    version: PackageJson.version,
    run: { models, usage },
    changes,
    traits,
    diagnostics: [
      ...preparation.setupDiagnostics,
      ...pipe(preparation.segmentations.values(), Array.fromIterable, Array.flatMap(Array.getFailures))
    ]
  })
})
