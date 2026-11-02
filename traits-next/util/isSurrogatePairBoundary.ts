import { Function, Option, String } from "effect"

/** Whether an offset avoids splitting a UTF-16 surrogate pair; does not validate bounds or grapheme boundaries. */
export const isSurrogatePairBoundary: {
  (offset: number): (text: string) => boolean
  (text: string, offset: number): boolean
} = Function.dual(2, (text: string, offset: number): boolean => {
  const previous = String.charCodeAt(text, offset - 1)
  const current = String.charCodeAt(text, offset)
  return !(
    Option.exists(previous, (code) => code >= 0xd800 && code <= 0xdbff) &&
    Option.exists(current, (code) => code >= 0xdc00 && code <= 0xdfff)
  )
})
