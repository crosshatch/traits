import { String } from "effect"

export const setupPrompt = (guideUrl: string) =>
  String.trim(
    String.stripMargin(`
|Set up Traits in this project using
|${guideUrl}.
|Follow our existing package-manager and workspace conventions, ask me to choose
|providers and models, and preserve existing configuration.
`)
  )
