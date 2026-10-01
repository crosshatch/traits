// @effect-diagnostics unstableApiUsage:skip-file -- HttpApi is intentionally used here.
import { HttpApi } from "effect/http-api"
import { HealthApiGroup } from "./health.ts"

export * as Health from "./health.ts"

export class CrosshatchApi extends HttpApi.make("CrosshatchApi").add(HealthApiGroup) {}
