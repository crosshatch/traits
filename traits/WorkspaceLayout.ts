/** The workspace directory holding trait files and environments, relative to the workspace root. */
export const directory = ".agents/traits"

/** The workspace configuration file, at the workspace root. */
export const config = "traits.json"

/** Named environment configurations; the underscore sorts them before trait files. */
export const environments = `${directory}/_environments`

/** The file defining the named trait. */
export const traitFile = (name: string) => `${directory}/${name}.md`

/** The file defining the named environment. */
export const environmentFile = (name: string) => `${environments}/${name}.json`
