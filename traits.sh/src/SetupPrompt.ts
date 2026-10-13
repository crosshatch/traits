import { String } from "effect"

const instructions = String.stripMargin(`
|Set up Traits in this project using
|https://github.com/crosshatch/traits/blob/main/SETUP.md.
|Follow our existing package-manager and workspace conventions, ask me to choose
|providers and models, and preserve existing configuration.
`)

export const setupPrompt = String.trim(instructions)
