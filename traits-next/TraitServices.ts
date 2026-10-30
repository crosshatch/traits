import type { DateTime, FileSystem, Path, Scope } from "effect"
import type { Chat, DecisionModel, EmbeddingModel, LanguageModel } from "effect/ai"
import type { Digest, SecureRandom } from "effect/crypto"
import type { HttpClient } from "effect/http"
import type { KeyValueStore } from "effect/persistence"
import type { ChildProcessSpawner } from "effect/process"

/**
 * Services available during trait extension setup and execution.
 * Each execution receives its own chat and scope; the setup scope outlives its executions.
 */
export type TraitServices =
  | Chat.Chat
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
