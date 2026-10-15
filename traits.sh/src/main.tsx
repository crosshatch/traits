import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"

import "@fontsource/libre-baskerville/latin-400.css"
import "@fontsource/libre-baskerville/latin-400-italic.css"
import "@fontsource/libre-baskerville/latin-700.css"

import { App } from "./App.tsx"

import "./style.css"

hydrateRoot(
  document.getElementById("root")!,
  <StrictMode>
    <App />
  </StrictMode>
)
