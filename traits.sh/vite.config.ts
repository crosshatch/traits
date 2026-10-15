import { Effect } from "effect"
import { createServer, defineConfig, type ViteDevServer } from "vite-plus"

let renderer: Promise<ViteDevServer> | undefined

const closeRenderer = Effect.gen(function* () {
  const closing = renderer
  renderer = undefined
  if (closing !== undefined) yield* Effect.promise(() => closing.then((server) => server.close()))
}).pipe(Effect.withSpan("closeRenderer"))

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
      transformIndexHtml: Effect.fn("prerender")(
        function* (html: string) {
          const server = yield* Effect.promise(
            () =>
              (renderer ??= createServer({
                root: import.meta.dirname,
                configFile: false,
                appType: "custom",
                logLevel: "error",
                server: { middlewareMode: true, ws: false, watch: null }
              }))
          )
          const { render } = (yield* Effect.promise(() =>
            server.ssrLoadModule("/src/prerender.tsx")
          )) as typeof import("./src/prerender.tsx")
          return html.replace('<div id="root"></div>', () => `<div id="root">${render()}</div>`)
        },
        (effect) => Effect.runPromise(effect)
      ),
      closeBundle: () => Effect.runPromise(closeRenderer)
    }
  ]
})
