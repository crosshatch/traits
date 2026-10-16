import { Schema as S } from "effect"

/** Include the class-owned message when encoding a tagged error for a tool response. */
export const errorResponse = <Fields extends S.Struct.Fields>(error: { readonly fields: Fields }) =>
  S.Struct({ ...error.fields, message: S.String })
