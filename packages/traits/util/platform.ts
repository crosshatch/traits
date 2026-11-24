/** The operating system and CPU architecture this process runs on, such as darwin-arm64. */
export const target = `${process.platform}-${process.arch}`

export const isWindows = process.platform === "win32"

/** The path of the running executable. */
export const executablePath = process.execPath
