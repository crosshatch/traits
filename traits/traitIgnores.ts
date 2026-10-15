import { String } from "effect"

/** File-scoped exceptions must appear in the leading line-comment header and include a reason. */
export const traitIgnores = (text: string): ReadonlySet<string> => {
  const names = new Set<string>()
  for (const line of String.split(text, "\n")) {
    const trimmed = String.trim(line)
    if (trimmed === "" || trimmed.startsWith("#!")) continue
    if (!trimmed.startsWith("//")) break
    const match = /^\/\/\s*traits-ignore-file\s+(\S+)\s*:\s*(\S.*)$/.exec(trimmed)
    const name = match?.[1]
    if (name !== undefined) names.add(name)
  }
  return names
}
