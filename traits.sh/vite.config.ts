/* oxlint-disable effecttsgo/async-function */
import { pipe, String } from "effect"
import { createServer, defineConfig, type ViteDevServer } from "vite-plus"

let renderer: Promise<ViteDevServer> | undefined

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    {
      name: "traits.sh:prerender",
      configureServer(server) {
        server.watcher.on("change", () => {
          void renderer?.then((rendering) => rendering.environments.ssr.moduleGraph.invalidateAll())
        })
      },
      async transformIndexHtml(html) {
        renderer ??= createServer({
          root: import.meta.dirname,
          configFile: false,
          appType: "custom",
          logLevel: "error",
          server: { middlewareMode: true, ws: false, watch: null }
        })
        const server = await renderer
        const { render } = (await server.ssrLoadModule("/src/prerender.tsx")) as typeof import("./src/prerender.tsx")
        const placeholder = '<div id="root"></div>'
        if (!pipe(html, String.includes(placeholder))) return html
        // Escape replacement-string tokens so rendered dollar sequences stay literal.
        const replacement = pipe(`<div id="root">${render()}</div>`, String.replaceAll("$", "$$$$"))
        return pipe(html, String.replace(placeholder, replacement))
      },
      async closeBundle() {
        const closing = renderer
        renderer = undefined
        await closing?.then((server) => server.close())
      }
    }
  ]
})
