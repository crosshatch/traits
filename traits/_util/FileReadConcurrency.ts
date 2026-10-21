import { Context } from "effect"

export class FileReadConcurrency extends Context.Service<FileReadConcurrency, number | "unbounded">()(
  "traits/_util/FileReadConcurrency"
) {}
