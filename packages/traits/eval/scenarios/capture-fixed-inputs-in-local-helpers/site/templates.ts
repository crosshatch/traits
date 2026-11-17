import { Effect, FileSystem } from "effect"

export const resolveTemplate = (root: string, name: string) => `${root}/templates/${name}`

export const renderPage = Effect.fn("site.renderPage")(function* (root: string, title: string, body: string) {
  const fs = yield* FileSystem.FileSystem
  const layout = yield* fs.readFileString(resolveTemplate(root, "layout.html"))
  const page = yield* fs.readFileString(resolveTemplate(root, "page.html"))
  const footer = yield* fs.readFileString(resolveTemplate(root, "footer.html"))
  return layout.replace("{{title}}", title).replace("{{content}}", page.replace("{{body}}", body) + footer)
})
