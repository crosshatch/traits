import { type Context, DateTime, FileSystem, Path } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { Digest, SecureRandom } from "effect/crypto"
import { HttpClient } from "effect/http"
import { KeyValueStore } from "effect/persistence"
import { ChildProcessSpawner } from "effect/process"

import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** Services a local host provides once to every extension: the portable extension services plus WorkspaceRoot; registries capture exactly these from the host context. */
export type HostServices = Context.Service.Identifier<(typeof HostServices)[number]>
export const HostServices = [
  LanguageModel.LanguageModel,
  DecisionModel.DecisionModel,
  DateTime.CurrentTimeZone,
  KeyValueStore.KeyValueStore,
  Digest.Digest,
  SecureRandom.SecureRandom,
  HttpClient.HttpClient,
  FileSystem.FileSystem,
  Path.Path,
  ChildProcessSpawner.ChildProcessSpawner,
  WorkspaceRoot
] as const
