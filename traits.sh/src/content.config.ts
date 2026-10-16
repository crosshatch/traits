import { z } from "astro/zod"
import { defineCollection } from "astro:content"

import { traitsLoader } from "./traitsLoader.ts"
import { TraitSource } from "./TraitSource.ts"

const traits = defineCollection({
  loader: traitsLoader([TraitSource.Local({ owner: "crosshatch", repo: "traits", directory: ".." })]),
  schema: z.object({
    traitId: z.string(),
    name: z.string(),
    when: z.string().optional(),
    skip: z.string().optional(),
    mime: z.array(z.string()),
    owner: z.string(),
    repo: z.string(),
    path: z.string(),
    url: z.url()
  })
})

export const collections = { traits }
