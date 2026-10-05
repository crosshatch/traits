import { Schema as S } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

export class HealthApiGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health", {
    success: S.Literal("ok").pipe(HttpApiSchema.asText())
  })
) {}
