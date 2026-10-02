import * as Cloudflare from "alchemy/Cloudflare"
import * as Test from "alchemy/Test/Vitest"
import { Effect } from "effect"
import { HttpClient } from "effect/http"
import { expect } from "vite-plus/test"

import Stack from "../alchemy.run.ts"

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers(),
  state: Cloudflare.state()
})

const stack = beforeAll(deploy(Stack), { timeout: 180_000 })

afterAll(destroy(Stack), { timeout: 180_000 })

test(
  "GET /health returns ok",
  Effect.gen(function* () {
    const { url } = yield* stack
    const response = yield* HttpClient.get(`${url}/health`)
    expect(response.status).toBe(200)
    expect(yield* response.text).toBe("ok")
  }).pipe(Effect.provide(Test.guardedFetchLayer("text/plain")))
)
