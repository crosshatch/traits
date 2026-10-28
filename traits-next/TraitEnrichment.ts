import type { Effect, FileSystem, Path, Scope } from "effect"
import type { DecisionModel, LanguageModel } from "effect/ai"
import type { HttpClient } from "effect/http"
import type { ChildProcessSpawner } from "effect/process"

import type { TraitEnrichmentContext } from "./TraitEnrichmentContext.ts"
import type { TraitEnrichmentError } from "./TraitEnrichmentError.ts"

/** Services available during enrichment setup and execution. */
export type TraitEnrichmentServices =
  | LanguageModel.LanguageModel
  | DecisionModel.DecisionModel
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Scope.Scope

/** Shared setup producing a per-input context Effect without modifying the trait body. */
export type TraitEnrichment = Effect.Effect<
  Effect.Effect<string, TraitEnrichmentError, TraitEnrichmentContext | TraitEnrichmentServices>,
  never,
  TraitEnrichmentServices
>
