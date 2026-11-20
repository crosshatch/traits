import { renderToString } from "react-dom/server"

import { App } from "./App.tsx"

export const prerender = () => renderToString(<App />)
