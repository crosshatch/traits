import { Effect, Option, pipe, String } from "effect"

import { runProcess } from "../process/runProcess.ts"

/** The main working tree's root from the output of `git worktree list --porcelain`, or none when it is bare or the output is unrecognized. Git lists the main working tree first, and marks it bare when there is none. */
export const parseMainWorktree = (stdout: string): Option.Option<string> => {
  const [first, second] = pipe(stdout, String.split("\n"))
  return first === undefined || second === "bare" || !pipe(first, String.startsWith("worktree "))
    ? Option.none()
    : Option.some(pipe(first, String.slice("worktree ".length)))
}

/** The root of the main working tree of the repository containing `root`, or none when Git fails or the repository has no working tree. */
export const findMainRoot = Effect.fn("git.findMainRoot")(function* (root: string) {
  const listed = yield* runProcess({ command: "git", args: ["worktree", "list", "--porcelain"], cwd: root }).pipe(
    Effect.option
  )
  return pipe(
    listed,
    Option.filter(({ exitCode }) => exitCode === 0),
    Option.flatMap(({ stdout }) => parseMainWorktree(stdout))
  )
})
