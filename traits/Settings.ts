import { Context, Effect, Schema as S } from "effect"

import { DecisionPolicy } from "./Report/DecisionPolicy.ts"
import { Probability } from "./util/Probability.ts"

const Count = S.Int.check(S.isGreaterThanOrEqualTo(1))

/** How checks gate, judge, and parallelize their work. */
export const CheckSettings = S.Struct({
  /**
   * The least subject no probability that rules a target out, so the trait is not assessed against it; 0.6 when
   * omitted. Wrongly ruling a target out hides a violation, while wrongly matching it costs one assessment, so no must
   * be clearly likelier than not. Answers near an even split vary between requests and with the other subjects sharing
   * them; in measurements, 0.6 stopped violations near the split from being ruled out at random, for about a fifth more
   * tokens.
   */
  ruleOut: Probability.pipe(
    S.withConstructorDefault(Effect.succeed(0.6)),
    S.withDecodingDefaultTypeKey(Effect.succeed(0.6))
  ).annotateKey({
    description:
      "The least subject no probability that rules a target out, so the trait is not assessed against it; 0.6 when omitted."
  }),
  /** The verdict policy traits check applies when --fail and --pass are omitted; with neither, it prints no verdict. */
  policy: DecisionPolicy.annotateKey({
    description:
      "The verdict policy traits check applies when --fail and --pass are omitted; with neither, it prints no verdict."
  }).pipe(S.optionalKey),
  /** Workspace files and Git revisions read at a time; 16 when omitted. */
  fileConcurrency: Count.pipe(
    S.withConstructorDefault(Effect.succeed(16)),
    S.withDecodingDefaultTypeKey(Effect.succeed(16))
  ).annotateKey({ description: "Workspace files and Git revisions read at a time; 16 when omitted." }),
  /** Changes segmented at a time by each segmenter; 8 when omitted. */
  segmentationConcurrency: Count.pipe(
    S.withConstructorDefault(Effect.succeed(8)),
    S.withDecodingDefaultTypeKey(Effect.succeed(8))
  ).annotateKey({ description: "Changes segmented at a time by each segmenter; 8 when omitted." }),
  /** Changes evaluated at a time, each against every selected trait, so a check's memory does not grow with the number of files; 32 when omitted. */
  evaluationConcurrency: Count.pipe(
    S.withConstructorDefault(Effect.succeed(32)),
    S.withDecodingDefaultTypeKey(Effect.succeed(32))
  ).annotateKey({
    description:
      "Changes evaluated at a time, each against every selected trait, so a check's memory does not grow with the number of files; 32 when omitted."
  }),
  /** Source texts digested at a time for the report; 8 when omitted. */
  digestConcurrency: Count.pipe(
    S.withConstructorDefault(Effect.succeed(8)),
    S.withDecodingDefaultTypeKey(Effect.succeed(8))
  ).annotateKey({ description: "Source texts digested at a time for the report; 8 when omitted." })
}).annotate({ description: "How checks gate, judge, and parallelize their work." })

/** How decision model requests are batched and retried. */
export const RequestSettings = S.Struct({
  /** The most decisions that concurrent decision calls about one input merge into one request; a call with more is sent alone; 32 when omitted. */
  batchSize: Count.pipe(
    S.withConstructorDefault(Effect.succeed(32)),
    S.withDecodingDefaultTypeKey(Effect.succeed(32))
  ).annotateKey({
    description:
      "The most decisions that concurrent decision calls about one input merge into one request; a call with more is sent alone; 32 when omitted."
  }),
  /** How long decision calls about one input are collected before their request is sent, in milliseconds; 10 when omitted. */
  batchWindowMillis: S.Natural.pipe(
    S.withConstructorDefault(Effect.succeed(10)),
    S.withDecodingDefaultTypeKey(Effect.succeed(10))
  ).annotateKey({
    description:
      "How long decision calls about one input are collected before their request is sent, in milliseconds; 10 when omitted."
  }),
  /** How many times a request that failed transiently, such as by a rate limit, is retried; 5 when omitted. */
  retries: S.Natural.pipe(
    S.withConstructorDefault(Effect.succeed(5)),
    S.withDecodingDefaultTypeKey(Effect.succeed(5))
  ).annotateKey({
    description:
      "How many times a request that failed transiently, such as by a rate limit, is retried; 5 when omitted."
  }),
  /** The first retry's delay in milliseconds, doubling with jitter for each later retry and never shorter than a rate limit asks; 1000 when omitted. */
  retryDelayMillis: S.Natural.pipe(
    S.withConstructorDefault(Effect.succeed(1000)),
    S.withDecodingDefaultTypeKey(Effect.succeed(1000))
  ).annotateKey({
    description:
      "The first retry's delay in milliseconds, doubling with jitter for each later retry and never shorter than a rate limit asks; 1000 when omitted."
  })
}).annotate({ description: "How decision model requests are batched and retried." })

/** How proposals are compared with existing traits. */
export const DeriveSettings = S.Struct({
  /** The most existing traits compared with a proposal in one request; 32 when omitted. */
  batchSize: Count.pipe(
    S.withConstructorDefault(Effect.succeed(32)),
    S.withDecodingDefaultTypeKey(Effect.succeed(32))
  ).annotateKey({ description: "The most existing traits compared with a proposal in one request; 32 when omitted." })
}).annotate({ description: "How proposals are compared with existing traits." })

/** Tunable thresholds and limits for checks, decision requests, and derivation; each takes its default when omitted, and Settings.make({}) holds every default. */
export type Settings = typeof Settings.Type
export const Settings = S.Struct({
  /** The maximum number of simultaneous decision model requests; 16 when omitted. */
  concurrency: Count.pipe(
    S.withConstructorDefault(Effect.succeed(16)),
    S.withDecodingDefaultTypeKey(Effect.succeed(16))
  ).annotateKey({ description: "The maximum number of simultaneous decision model requests; 16 when omitted." }),
  /** How checks gate, judge, and parallelize their work. */
  check: CheckSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => CheckSettings.make({}))),
    S.withDecodingDefaultTypeKey(Effect.sync(() => CheckSettings.make({})))
  ).annotateKey({ description: "How checks gate, judge, and parallelize their work." }),
  /** How decision model requests are batched and retried. */
  requests: RequestSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => RequestSettings.make({}))),
    S.withDecodingDefaultTypeKey(Effect.sync(() => RequestSettings.make({})))
  ).annotateKey({ description: "How decision model requests are batched and retried." }),
  /** How proposals are compared with existing traits. */
  derive: DeriveSettings.pipe(
    S.withConstructorDefault(Effect.sync(() => DeriveSettings.make({}))),
    S.withDecodingDefaultTypeKey(Effect.sync(() => DeriveSettings.make({})))
  ).annotateKey({ description: "How proposals are compared with existing traits." })
}).annotate({
  description:
    "Tunable thresholds and limits for checks, decision requests, and derivation; each takes its default when omitted."
})

/** The settings in effect; the defaults unless a host provides the workspace's. */
export const CurrentSettings = Context.Reference<Settings>("traits/Settings", {
  defaultValue: () => Settings.make({})
})
