---
name: css-first-presentation-defaults
---
Derive presentation defaults that CSS can detect from user or device preferences in CSS, so the page renders correctly before or without JavaScript: follow the system color scheme with color-scheme: light dark and light-dark() or prefers-color-scheme, not a script that reads matchMedia and sets a theme attribute on load. Use JavaScript only to apply and persist explicit user overrides, such as setting data-theme from a saved choice, and keep any pre-paint override script minimal.
