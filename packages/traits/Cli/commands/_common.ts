import { Command } from "effect/cli"

/** Describes a command as experimental: its flags, output, and stored data may change without notice. */
export const withExperimentalDescription = (description: string) =>
  Command.withDescription(`(experimental) ${description}`)
