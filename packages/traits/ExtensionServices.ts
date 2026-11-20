import type { DateTime, FileSystem, Path, Scope } from "effect"
import type { Chat, DecisionModel, LanguageModel } from "effect/ai"
import type { Digest, SecureRandom } from "effect/crypto"
import type { HttpClient } from "effect/http"
import type { KeyValueStore } from "effect/persistence"
import type { ChildProcessSpawner } from "effect/process"

/**
 * Services available during trait extension setup and execution: portable services the host provides once
 * to every extension, plus a chat and scope the registry creates for each execution. Setup is shared per
 * extension across the program lifecycle; its scope outlives dependent executions until shutdown or explicit
 * reset. Local hosts additionally provide WorkspaceRoot (traits/local) for extensions that read workspace files.
 */
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
