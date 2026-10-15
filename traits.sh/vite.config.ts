/* oxlint-disable effecttsgo/async-function */
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
        return html.replace('<div id="root"></div>', () => `<div id="root">${render()}</div>`)
      },
      async closeBundle() {
        const closing = renderer
        renderer = undefined
        await closing?.then((server) => server.close())
      }
    }
  ]
})
