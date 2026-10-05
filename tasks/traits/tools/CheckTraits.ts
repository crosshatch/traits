import { FileSystem, Path, Schema as S, String } from "effect"
import { DecisionModel, Tool, Toolkit } from "effect/ai"
import { ChildProcessSpawner } from "effect/process"

import * as Check from "../Check.ts"
import { Report } from "../Domain.ts"
import { Target } from "../Target.ts"
import { TraitsContext } from "../TraitsContext.ts"

export const CheckTraits = Tool.make("check-traits", {
  dependencies: [
    FileSystem.FileSystem,
    Path.Path,
    ChildProcessSpawner.ChildProcessSpawner,
    DecisionModel.DecisionModel,
    TraitsContext
  ],
  description: String.stripMargin(`
    | Review the selected target against current .agents/traits/*.md using Jev.
    | Choose the target based on the user's task: changes for a change review, Dirs for directory audits, or Files for explicit files.
    | Targets use _tag: Staged, Unstaged (tracked changes only), Untracked, Changed, Dirs, or Files.
    | Changed includes staged, unstaged, and untracked changes.
    | Dirs recursively globs complete files, including unchanged and hidden files, excluding .git and node_modules.
    | Use { _tag: "Dirs", dirs: ["."] } for the repository root, or specify repository-relative or absolute directories.
    | For full file contents, use { _tag: "Files", files: ["path", "another/path"] }. Duplicate paths are reviewed once.
    | File paths are relative to the repository root or absolute. Before committing, use staged.
    | Returns nonpassing traits and probabilities. Inspect the diff to locate violations.
    | Fix findings, restage and rerun before committing.
    | Only status "pass" indicates a passing review.
    | For ConfigError, ask the user to add the missing setting to the repository root or worktree .env,
    | or the MCP process environment, then restart the server. Jev requires TYPESAFE_API_KEY.
  `),
  parameters: S.Struct({ target: Target }),
  success: Report,
  failure: S.Defect()
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)

export const toolkit = Toolkit.make(CheckTraits)

export const layer = toolkit.toLayer({
  "check-traits": ({ target }) => Check.check({ target })
})
