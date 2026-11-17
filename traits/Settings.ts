import { Context, Effect, Schema as S } from "effect"

import { DecisionPolicy } from "./Report/DecisionPolicy.ts"
import { Probability } from "./util/Probability.ts"

const Count = S.Int.check(S.isGreaterThanOrEqualTo(1))

/** How close calls are settled: a subject or assessment decision whose deciding probability lands near its threshold is asked again and its answers averaged, so a check gives the same verdict on every run. */
export const ResamplingSettings = S.Struct({
  /** A decision whose deciding probability is within this distance of its threshold is asked again; 0.15 when omitted. */
  margin: Probability.annotateKey({
    description:
      "A decision whose deciding probability is within this distance of its threshold is asked again; 0.15 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(0.15)), S.withDecodingDefaultKey(Effect.succeed(0.15))),
  /** How many answers a decision within margin of its threshold averages; 1 asks once, turning resampling off; 3 when omitted. */
  samples: Count.annotateKey({
    description:
      "How many answers a decision within margin of its threshold averages; 1 asks once, turning resampling off; 3 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(3)), S.withDecodingDefaultKey(Effect.succeed(3))),
  /** A decision whose averaged probability is still within this distance of its threshold is asked again; 0.05 when omitted. */
  closeMargin: Probability.annotateKey({
    description:
      "A decision whose averaged probability is still within this distance of its threshold is asked again; 0.05 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(0.05)), S.withDecodingDefaultKey(Effect.succeed(0.05))),
  /** How many answers a decision still within closeMargin averages, at least samples; 5 when omitted. */
  closeSamples: Count.annotateKey({
    description: "How many answers a decision still within closeMargin averages, at least samples; 5 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(5)), S.withDecodingDefaultKey(Effect.succeed(5)))
})
  .annotate({
    description:
      "How close calls are settled: a subject or assessment decision whose deciding probability lands near its threshold is asked again and its answers averaged, so a check gives the same verdict on every run."
  })
  .check(
    S.makeFilter((settings) => settings.closeSamples >= settings.samples, {
      message: "closeSamples must be at least samples."
    })
  )

/** How checks gate, judge, and parallelize their work. */
export const CheckSettings = S.Struct({
  /**
   * The least subject no probability that rules a target out, so the trait is not assessed against it; 0.6 when
   * omitted. Wrongly ruling a target out hides a violation, while wrongly matching it costs one assessment, so no must
   * be clearly likelier than not. Answers near an even split vary between requests and with the other subjects sharing
   * them; in measurements, 0.6 stopped violations near the split from being ruled out at random, for about a fifth more
   * tokens.
   */
  ruleOut: Probability.annotateKey({
    description:
      "The least subject no probability that rules a target out, so the trait is not assessed against it; 0.6 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(0.6)), S.withDecodingDefaultKey(Effect.succeed(0.6))),
  /** The verdict policy traits check applies when --fail and --pass are omitted; with neither, it prints no verdict. */
  policy: DecisionPolicy.annotateKey({
    description:
      "The verdict policy traits check applies when --fail and --pass are omitted; with neither, it prints no verdict."
  }).pipe(S.optionalKey),
  /** How close calls are settled. Assessments are settled against policy, or fail and pass thresholds of 0.5 without one. */
  resampling: ResamplingSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => ResamplingSettings.make({}))),
    S.withDecodingDefaultKey(Effect.succeed({}))
  ),
  /** Workspace files and Git revisions read at a time; 16 when omitted. */
  fileConcurrency: Count.annotateKey({
    description: "Workspace files and Git revisions read at a time; 16 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(16)), S.withDecodingDefaultKey(Effect.succeed(16))),
  /** Changes segmented at a time by each segmenter; 8 when omitted. */
  segmentationConcurrency: Count.annotateKey({
    description: "Changes segmented at a time by each segmenter; 8 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(8)), S.withDecodingDefaultKey(Effect.succeed(8))),
  /** Changes evaluated at a time, each against every selected trait, so a check's memory does not grow with the number of files; 32 when omitted. */
  evaluationConcurrency: Count.annotateKey({
    description:
      "Changes evaluated at a time, each against every selected trait, so a check's memory does not grow with the number of files; 32 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(32)), S.withDecodingDefaultKey(Effect.succeed(32))),
  /** Source texts digested at a time for the report; 8 when omitted. */
  digestConcurrency: Count.annotateKey({
    description: "Source texts digested at a time for the report; 8 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(8)), S.withDecodingDefaultKey(Effect.succeed(8)))
}).annotate({ description: "How checks gate, judge, and parallelize their work." })

/** How decision model requests are batched and retried. */
export const RequestSettings = S.Struct({
  /** The most decisions that concurrent decision calls about one input merge into one request; a call with more is sent alone; 32 when omitted. */
  batchSize: Count.annotateKey({
    description:
      "The most decisions that concurrent decision calls about one input merge into one request; a call with more is sent alone; 32 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(32)), S.withDecodingDefaultKey(Effect.succeed(32))),
  /** How long decision calls about one input are collected before their request is sent, in milliseconds; 10 when omitted. */
  batchWindowMillis: S.Natural.annotateKey({
    description:
      "How long decision calls about one input are collected before their request is sent, in milliseconds; 10 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(10)), S.withDecodingDefaultKey(Effect.succeed(10))),
  /** How many times a request that failed transiently, such as by a rate limit, is retried; 5 when omitted. */
  retries: S.Natural.annotateKey({
    description:
      "How many times a request that failed transiently, such as by a rate limit, is retried; 5 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(5)), S.withDecodingDefaultKey(Effect.succeed(5))),
  /** The first retry's delay in milliseconds, doubling with jitter for each later retry and never shorter than a rate limit asks; 1000 when omitted. */
  retryDelayMillis: S.Natural.annotateKey({
    description:
      "The first retry's delay in milliseconds, doubling with jitter for each later retry and never shorter than a rate limit asks; 1000 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(1000)), S.withDecodingDefaultKey(Effect.succeed(1000)))
}).annotate({ description: "How decision model requests are batched and retried." })

/** How proposals are compared with existing traits. */
export const DeriveSettings = S.Struct({
  /** The most existing traits compared with a proposal in one request; 32 when omitted. */
  batchSize: Count.annotateKey({
    description: "The most existing traits compared with a proposal in one request; 32 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(32)), S.withDecodingDefaultKey(Effect.succeed(32)))
}).annotate({ description: "How proposals are compared with existing traits." })

/** Tunable thresholds and limits for checks, decision requests, and derivation; each takes its default when omitted, and Settings.make({}) holds every default. */
export type Settings = typeof Settings.Type
export const Settings = S.Struct({
  /** The maximum number of simultaneous decision model requests; 16 when omitted. */
  concurrency: Count.annotateKey({
    description: "The maximum number of simultaneous decision model requests; 16 when omitted."
  }).pipe(S.withConstructorDefault(Effect.succeed(16)), S.withDecodingDefaultKey(Effect.succeed(16))),
  /** How checks gate, judge, and parallelize their work. */
  check: CheckSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => CheckSettings.make({}))),
    S.withDecodingDefaultKey(Effect.succeed({}))
  ),
  /** How decision model requests are batched and retried. */
  requests: RequestSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => RequestSettings.make({}))),
    S.withDecodingDefaultKey(Effect.succeed({}))
  ),
  /** How proposals are compared with existing traits. */
  derive: DeriveSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => DeriveSettings.make({}))),
    S.withDecodingDefaultKey(Effect.succeed({}))
  )
}).annotate({
  description:
    "Tunable thresholds and limits for checks, decision requests, and derivation; each takes its default when omitted."
})

/** The settings in effect; the defaults unless a host provides the workspace's. */
export const CurrentSettings = Context.Reference<Settings>("traits/Settings", {
  defaultValue: () => Settings.make({})
})
