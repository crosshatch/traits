import { Effect, Result, String } from "effect"
import { DecisionModel } from "effect/ai"

import { Trait } from "./Domain.ts"
import * as CreateTrait from "./tools/CreateTrait.ts"
import * as Traits from "./Traits.ts"
import { TraitsContext } from "./TraitsContext.ts"

export const inspect = Effect.fn("traits.reconcile")(function* (proposed: Trait) {
  const loaded = yield* Traits.load()
  const concerns: Array<typeof CreateTrait.Concern.Type> = []
  const errors: Array<string> = []
  if (loaded.length > 0) {
    const {
      config: { passThreshold: threshold }
    } = yield* TraitsContext
    const checks = yield* Effect.forEach(
      loaded,
      Effect.fn("traits.compare")(function* (existing) {
        const input = { proposed, existing }
        const result = yield* DecisionModel.decide(CreateTrait.decision, { input }).pipe(
          Effect.timeout("90 seconds"),
          Effect.result
        )
        return { existing, result }
      }),
      { concurrency: "unbounded" }
    )
    for (const { existing, result } of checks) {
      if (Result.isFailure(result)) {
        errors.push(`${existing.path}: ${result.failure.toString()}`)
        continue
      }
      const answer = result.success.answers.relationship
      if (answer.label !== "distinct" || answer.probabilities.distinct < threshold) {
        concerns.push({
          existing,
          relationship: answer.label,
          distinctProbability: answer.probabilities.distinct,
          threshold,
          probabilities: answer.probabilities
        })
      }
    }
  }
  if (concerns.length === 0 && errors.length === 0) return undefined
  return {
    status: errors.length > 0 ? "review-unavailable" : "reconciliation-required",
    proposed,
    concerns,
    errors,
    guidance:
      errors.length > 0
        ? String.stripMargin(`
            | No file was written. Report the review errors to the user.
            | For ConfigError, ask the user to add the missing configuration
            | (TYPESAFE_API_KEY in the repository root or worktree .env, or MCP process environment), then retry.
            | An unavailable comparison is not evidence of overlapping traits.
          `)
        : String.stripMargin(`
            | No file was written. Read the identified existing traits, explain the overlap/conflict or uncertainty,
            | and propose a concrete reconciliation: reuse the existing trait, clarify scopes, or merge into one trait.
            | Show the exact resulting filenames, full text, and any removals.
            | Ask the user to approve, revise, or cancel using an interactive question if available,
            | otherwise a text question. Never rewrite or remove existing traits without approval.
            | After approval, apply the agreed edits with the coding agent's file tools and retry creation
            | only if a separate new trait is still needed.
          `)
  } satisfies CreateTrait.Blocked
})
