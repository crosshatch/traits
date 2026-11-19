import { Context } from "effect"

import type { KeyValueShape } from "./Cache.ts"

export class SessionStore extends Context.Service<SessionStore, KeyValueShape>()("services/SessionStore") {}
