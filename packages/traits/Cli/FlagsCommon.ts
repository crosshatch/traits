import { Schema as S } from "effect"
import { Flag } from "effect/cli"

import { Probability } from "../util/Probability.ts"

export const dotenv = Flag.String("dotenv").pipe(
  Flag.withMetavar("file"),
  Flag.withDescription(
    "The .env file to read the model's credentials from, looked for from the current directory, then the workspace root, and then the root of the repository's main worktree; .env when omitted, which is passed over when there is none. A variable already set in the environment takes precedence over the file"
  ),
  Flag.optional
)

export const threshold = Flag.Finite("threshold").pipe(
  Flag.withSchema(Probability),
  Flag.withDefault(Probability.make(0.5)),
  Flag.withDescription(
    "The probability, from 0 to 1, at or above which a trait applies to what is checked, and below which its assertion counts as violated"
  )
)

export const stopAfterCost = Flag.Finite("stop-after-cost").pipe(
  Flag.withSchema(S.Finite.check(S.isGreaterThan(0))),
  Flag.withDescription(
    "The cost, in US dollars, after which the run asks nothing more, for a provider that reports what its requests cost. Requests already under way are finished, so the run may cost somewhat more. What is not asked is left not assessed, and running again carries on from the answers already given"
  ),
  Flag.optional
)

export const dry = Flag.Boolean("dry").pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    "Print what the run would cost, at the least and at the most, without asking the model anything or needing its credentials"
  )
)

export const json = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the full report, or the estimate with --dry, as JSON instead of a readable summary")
)
