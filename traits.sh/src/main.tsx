import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "@fontsource/libre-baskerville/latin-400.css"
import "@fontsource/libre-baskerville/latin-400-italic.css"
import "@fontsource/libre-baskerville/latin-700.css"

import { App } from "./App.tsx"

import "./style.css"
const root = document.getElementById("root")

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
