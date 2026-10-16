import { Formatter, Predicate, Struct } from "effect"

// Error.message/stack/cause are often non-enumerable. Keep them alongside every
// case-specific field, rather than using Defect's message-only Error encoding.
const snapshot = (error: unknown, seen: WeakSet<object>): unknown => {
  if (!Predicate.isError(error)) return error
  if (seen.has(error)) return { _tag: "CircularCause", message: "Circular error cause" }
  seen.add(error)
  return Struct.assign(error, {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: snapshot(error.cause, seen)
  })
}

/** JSON formatting handles nested native error properties, redaction and cycles. */
export const diagnostic = (error: unknown) => {
  const details = snapshot(error, new WeakSet())
  return Predicate.isObject(details)
    ? {
        ...details,
        _tag: Predicate.isString(details._tag) ? details._tag : "UnexpectedFailure",
        message: Predicate.isString(details.message) ? details.message : Formatter.format(error)
      }
    : { _tag: "UnexpectedFailure", message: Formatter.format(error), value: details }
}
