import type { DateTime, FileSystem, Path, Scope } from "effect"
import type { Chat, DecisionModel, LanguageModel } from "effect/ai"
import type { Digest, SecureRandom } from "effect/crypto"
import type { HttpClient } from "effect/http"
import type { KeyValueStore } from "effect/persistence"
import type { ChildProcessSpawner } from "effect/process"

export type ExtensionServices =
  | LanguageModel.LanguageModel
  | DecisionModel.DecisionModel
  | DateTime.CurrentTimeZone
  | KeyValueStore.KeyValueStore
  | Digest.Digest
  | SecureRandom.SecureRandom
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Chat.Chat
  | Scope.Scope
