---
name: css-first-scroll-layout
when: implementing scroll-dependent UI layout, sticky positioning, or visibility behavior.
mime: [text/css, text/html, text/tsx, text/jsx, text/typescript, text/javascript]
skip: When every scripted scroll-dependent behavior under assessment implements a requirement that DOM placement, layout, and CSS cannot reliably express.
---
Prefer DOM placement, appropriate containing blocks, and CSS positioning for scroll-dependent UI layout such as sticky bars. Do not add JavaScript scroll listeners, visibility atoms, or reveal/hide logic when CSS can reliably express the intended behavior. Use scripted behavior only when the requirement cannot be achieved reliably through layout and styling.
