import type { DateTime, FileSystem, Path, Scope } from "effect"
import type { DecisionModel, EmbeddingModel, LanguageModel } from "effect/ai"
import type { Digest, SecureRandom } from "effect/crypto"
import type { HttpClient } from "effect/http"
import type { KeyValueStore } from "effect/persistence"
import type { ChildProcessSpawner } from "effect/process"

/** Services available during enrichment setup and execution. */
export type TraitEnrichmentServices =
  | LanguageModel.LanguageModel
  | DecisionModel.DecisionModel
  | EmbeddingModel.EmbeddingModel
  | DateTime.CurrentTimeZone
  | KeyValueStore.KeyValueStore
  | Digest.Digest
  | SecureRandom.SecureRandom
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Scope.Scope
