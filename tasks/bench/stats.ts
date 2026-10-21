import { Array, Number } from "effect"

/** Independent-process paired log-ratio bootstrap, matching Effect runtimeperf. */
export const median = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) throw new Error("Cannot take the median of an empty sample")
  const sorted = Array.sort(values, Number.Order)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

export const comparePairs = (options: {
  readonly base: ReadonlyArray<number>
  readonly head: ReadonlyArray<number>
}) => {
  const { base, head } = options
  if (base.length !== head.length || base.length < 2) throw new Error("Need at least two paired process observations")
  const logs = Array.map(base, (value, index) => Math.log(head[index]! / value))
  let state = 0x5eed1234
  const samples: Array<number> = []
  for (let iteration = 0; iteration < 10_000; iteration++) {
    const sampled: Array<number> = []
    for (let index = 0; index < logs.length; index++) {
      state += 0x6d2b79f5
      let value = state
      // imul's 32-bit multiplication is required for the reference PRNG's exact sequence.
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      const random = ((value ^ (value >>> 14)) >>> 0) / 4294967296
      sampled.push(logs[Math.floor(random * logs.length)]!)
    }
    samples.push(median(sampled))
  }
  const ordered = Array.sort(samples, Number.Order)
  const percentile = (p: number) => {
    const index = (ordered.length - 1) * p
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    return ordered[lower]! * (1 - (index - lower)) + ordered[upper]! * (index - lower)
  }
  return {
    baseMedianMs: median(base),
    headMedianMs: median(head),
    headOverBase: Math.exp(median(logs)),
    lowRatio: Math.exp(percentile(0.025)),
    highRatio: Math.exp(percentile(0.975)),
    confidence: 0.95
  }
}
