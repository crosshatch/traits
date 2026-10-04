import type { RuntimeContext } from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import type * as Drizzle from "alchemy/Drizzle"
import * as DrizzleCloudflare from "alchemy/Drizzle/Cloudflare"
import { eq, sql } from "drizzle-orm"
import { Effect } from "effect"

import { relations } from "./relations.ts"
import { counter } from "./schema.ts"

export class AccountActor extends Cloudflare.DurableObject<
  AccountActor,
  {
    readonly increment: Effect.Effect<void, Drizzle.EffectDrizzleQueryError, RuntimeContext>
    readonly decrement: Effect.Effect<void, Drizzle.EffectDrizzleQueryError, RuntimeContext>
    readonly count: Effect.Effect<number, Drizzle.EffectDrizzleQueryError, RuntimeContext>
  }
>()("AccountActor") {}

export default AccountActor.make(
  Effect.gen(function* () {
    const migrations = yield* Cloudflare.SqlMigrations(`${import.meta.dirname}/migrations`)

    return Effect.gen(function* () {
      const db = yield* DrizzleCloudflare.DurableObject({ migrations, relations })

      const update = (delta: number) =>
        db
          .insert(counter)
          .values({ id: 1, value: delta })
          .onConflictDoUpdate({
            target: counter.id,
            set: { value: sql`${counter.value} + ${delta}` }
          })

      return {
        increment: update(1),
        decrement: update(-1),
        count: db
          .select({ value: counter.value })
          .from(counter)
          .where(eq(counter.id, 1))
          .pipe(Effect.map((rows) => rows[0]?.value ?? 0))
      }
    })
  })
)
