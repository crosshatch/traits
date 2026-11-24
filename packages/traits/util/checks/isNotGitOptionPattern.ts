import { Schema as S } from "effect"

// Git reads an argument that starts with a hyphen as an option, which a URL or ref could use to run a command.
export const isNotGitOptionPattern = S.isPattern(/^[^-]/u, {
  message: "Expected a value that does not start with a hyphen."
})
