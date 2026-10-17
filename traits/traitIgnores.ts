import { Array, flow, String } from "effect"

import type { Trait } from "./Trait.ts"

/** File-scoped exceptions must appear in the leading line-comment header and include a reason. */
export const traitIgnores = (text: string): ReadonlySet<string> => {
  const references = new Set<string>()
  for (const line of String.split(text, "\n")) {
    const trimmed = String.trim(line)
    if (trimmed === "" || trimmed.startsWith("#!")) continue
    if (!trimmed.startsWith("//")) break
    const match = /^\/\/\s*traits-ignore-file\s+(\S+)\s*:\s*(\S.*)$/.exec(trimmed)
    const reference = match?.[1]
    if (reference !== undefined) references.add(reference)
  }
  return references
}

/** References match unique trait names exactly. */
export const excludeIgnored = flow(traitIgnores, (references) =>
  Array.filter<Trait>((trait) => !references.has(trait.name))
)
