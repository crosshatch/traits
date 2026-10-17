import { Option, Record } from "effect"

const labels: Record<string, string> = {
  "application/json": "JSON",
  "application/toml": "TOML",
  "application/yaml": "YAML",
  "text/css": "CSS",
  "text/html": "HTML",
  "text/javascript": "JavaScript",
  "text/jsx": "JSX",
  "text/markdown": "Markdown",
  "text/tsx": "TSX",
  "text/typescript": "TypeScript"
}

export const mimeLabel = (mime: string) => Option.getOrElse(Record.get(labels, mime), () => mime)
