import { isSea } from "node:sea"

import { Context, Layer } from "effect"

import PackageJson from "../package.json" with { type: "json" }
import * as Platform from "./platform.ts"

/** The running traits executable, and the platform it was built for. */
export class Executable extends Context.Service<
  Executable,
  {
    /** Whether this is the standalone executable, rather than a copy running on Node.js. */
    readonly standalone: boolean
    /** The platform and architecture it runs on, such as darwin-arm64. */
    readonly target: string
    /** The executable file. */
    readonly path: string
    /** The installed version. */
    readonly version: string
  }
>()("traits/util/Executable") {}

export const layer = Layer.succeed(Executable, {
  standalone: isSea(),
  target: Platform.target,
  path: Platform.executablePath,
  version: PackageJson.version
})
