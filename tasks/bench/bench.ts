import { Array, Option, pipe, Schema as S, String } from "effect"
import { Command, Flag } from "effect/cli"

import { compare } from "./compare.ts"

const positive = (name: string, fallback: number) =>
  Flag.Int(name).pipe(Flag.withSchema(S.Int.check(S.isGreaterThan(0))), Flag.withDefault(fallback))

export const bench = Command.make("bench", {
  base: Flag.String("base").pipe(Flag.withDefault("main")),
  iterations: positive("iterations", 1),
  output: Flag.String("output").pipe(Flag.optional),
  rounds: Flag.Int("rounds").pipe(Flag.withSchema(S.Int.check(S.isGreaterThanOrEqualTo(2))), Flag.withDefault(7)),
  sizes: Flag.String("sizes").pipe(
    Flag.withSchema(S.String.check(S.isPattern(/^(real|[1-9][0-9]*)(,(real|[1-9][0-9]*))*$/))),
    Flag.withDefault("real,1000")
  ),
  time: positive("time", 500),
  warmup: positive("warmup", 150)
}).pipe(
  Command.withHandler((options) =>
    compare({
      ...options,
      sizes: pipe(
        options.sizes,
        String.split(","),
        Array.map((size) => (size === "real" ? "real" : Number(size)))
      ),
      output: Option.getOrUndefined(options.output)
    })
  )
)
