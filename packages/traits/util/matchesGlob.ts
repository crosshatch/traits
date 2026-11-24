import { Array, pipe, String } from "effect"

/** The text with every character that means something in a regular expression escaped. */
const literal = String.replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&")

/** Where the brace that closes the one at this position is, taking nested braces into account, or nothing when it is never closed. */
const closing = (pattern: string, open: number): number | undefined => {
  let depth = 0
  for (let index = open; index < pattern.length; index++) {
    if (pattern[index] === "{") {
      depth++
    } else if (pattern[index] === "}" && --depth === 0) {
      return index
    }
  }
  return undefined
}

/** The alternatives between a pair of braces, split at the commas that are not inside nested braces. */
const alternatives = (inside: string): ReadonlyArray<string> => {
  const parts: Array<string> = []
  let depth = 0
  let start = 0
  for (let index = 0; index < inside.length; index++) {
    if (inside[index] === "{") {
      depth++
    } else if (inside[index] === "}") {
      depth--
    } else if (inside[index] === "," && depth === 0) {
      parts.push(pipe(inside, String.slice(start, index)))
      start = index + 1
    }
  }
  return [...parts, pipe(inside, String.slice(start))]
}

/** The regular expression source for a glob pattern. */
const source = (pattern: string): string => {
  let result = ""
  let index = 0
  while (index < pattern.length) {
    const rest = pipe(pattern, String.slice(index))
    const end = pattern[index] === "{" ? closing(pattern, index) : undefined
    if (pipe(rest, String.startsWith("**/"))) {
      // Any number of directories, including none.
      result += "(?:.*/)?"
      index += 3
    } else if (pipe(rest, String.startsWith("**"))) {
      result += ".*"
      index += 2
    } else if (pattern[index] === "*") {
      result += "[^/]*"
      index += 1
    } else if (pattern[index] === "?") {
      result += "[^/]"
      index += 1
    } else if (end !== undefined) {
      const inside = pipe(pattern, String.slice(index + 1, end))
      result += `(?:${pipe(alternatives(inside), Array.map(source), Array.join("|"))})`
      index = end + 1
    } else {
      // A brace that is never closed is an ordinary character, like any other.
      result += literal(pattern[index] ?? "")
      index += 1
    }
  }
  return result
}

/** Whether a slash-separated path matches a glob pattern: * matches within one name, ** across directories, ? one character, and {a,b} either alternative. A pattern is matched against the whole path, so one for a file at any depth starts with a double star and a slash. */
export const matchesGlob = (pattern: string): ((path: string) => boolean) => {
  const expression = new RegExp(`^${source(pattern)}$`, "u")
  return (path) => expression.test(path)
}
