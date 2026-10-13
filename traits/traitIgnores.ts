import { pipe, String } from "effect"

/** File-scoped exceptions must appear in the leading line-comment header and include a reason. */
export const traitIgnores = (text: string): ReadonlySet<string> => {
  const ids = new Set<string>()
  for (const line of String.split(text, "\n")) {
    const trimmed = String.trim(line)
    if (trimmed === "" || pipe(trimmed, String.startsWith("#!"))) continue
    if (!pipe(trimmed, String.startsWith("//"))) break
    const match = /^\/\/\s*traits-ignore-file\s+(\S+)\s*:\s*(\S.*)$/.exec(trimmed)
    if (match?.[1] !== undefined) ids.add(match[1])
  }
  return ids
}
