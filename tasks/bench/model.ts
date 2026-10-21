import { Schema as S } from "effect"

export const variants = ["main-fs", "head-sqlite"] as const
export const workloads = [
  "get",
  "get-missing",
  "ls",
  "list-filter",
  "list-json",
  "get-16-concurrent",
  "update",
  "update-read",
  "update-burst-16",
  "external-burst-16-visible",
  "add-remove-cycle",
  "external-replace-visible"
] as const
export type Workload = typeof Workload.Type
export const Workload = S.Literals(workloads)

export type WorkerOptions = typeof WorkerOptions.Type
export const WorkerOptions = S.Struct({
  fixture: S.NonEmptyString,
  iterations: S.Int.check(S.isGreaterThan(0)),
  round: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  source: S.NonEmptyString,
  timeMs: S.Int.check(S.isGreaterThan(0)),
  variant: S.Literals(variants),
  warmupIterations: S.Int.check(S.isGreaterThan(0)),
  warmupMs: S.Int.check(S.isGreaterThan(0))
})

export type Fixture = typeof Fixture.Type
// Keep this wire schema independent of Trait.ts: importing it before the worker timer would hide its startup cost.
export const Fixture = S.Struct({
  bytes: S.Int.check(S.isGreaterThan(0)),
  query: S.NonEmptyString,
  records: S.Array(
    S.Struct({
      applicability: S.String.pipe(S.UndefinedOr, S.optional),
      context: S.String.pipe(S.UndefinedOr, S.optional),
      name: S.NonEmptyString,
      purpose: S.String,
      requirement: S.String,
      subject: S.String
    })
  ).check(S.isMinLength(1))
})

export type Measurement = typeof Measurement.Type
export const Measurement = S.Struct({
  ioIncludingWarmup: S.Struct({ markdownEvents: S.Int, reads: S.Int, scans: S.Int, watchEvents: S.Int }),
  meanMs: S.Finite.check(S.isGreaterThan(0)),
  name: Workload,
  p50Ms: S.Finite,
  p99Ms: S.Finite,
  rme: S.Finite.pipe(S.NullOr),
  samples: S.Int.check(S.isGreaterThan(0))
})

export type WorkerResult = typeof WorkerResult.Type
export const WorkerResult = S.Struct({
  count: S.Int.check(S.isGreaterThan(0)),
  databaseBytes: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  fixtureBytes: S.Int.check(S.isGreaterThan(0)),
  matches: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  memory: S.Struct({ heapUsedDelta: S.Finite, rssDelta: S.Finite }),
  results: S.Array(Measurement),
  round: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  sink: S.Int,
  source: S.String,
  startup: S.Struct({ buildMs: S.Finite, firstListMs: S.Finite, importMs: S.Finite, totalMs: S.Finite }),
  variant: S.Literals(variants)
})

export interface CompareOptions {
  readonly base: string
  readonly rounds: number
  readonly time: number
  readonly warmup: number
  readonly iterations: number
  readonly sizes: ReadonlyArray<"real" | number>
  readonly output?: string | undefined
}
