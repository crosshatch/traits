---
name: css-first-scroll-layout
subject: "Scroll-dependent UI layout, positioning, and visibility. Exception:
  When every scripted scroll-dependent behavior under assessment implements a
  requirement that DOM placement, layout, and CSS cannot reliably express."
match: "**/*.{css,html,ts,tsx,mts,cts,js,jsx,mjs,cjs}"
assertion: Prefer DOM placement, appropriate containing blocks, and CSS
  positioning for scroll-dependent UI layout such as sticky bars. Do not add
  JavaScript scroll listeners, visibility atoms, or reveal/hide logic when CSS
  can reliably express the intended behavior. Use scripted behavior only when
  the requirement cannot be achieved reliably through layout and styling.
purpose: Keep scroll-dependent presentation reliable through native layout
  rather than synchronizing JavaScript with scrolling.
---

```diff
-window.addEventListener("scroll", () => header.classList.toggle("fixed", window.scrollY > 100))
+/* Place the header in its intended scroll container. */
+header { position: sticky; top: 0; }
```

Not a violation: script that derives state CSS cannot set. Marking the current section's link with `aria-current` from scroll position is one case, because CSS cannot write ARIA attributes. Pausing a timed autoplay while its region is off screen, with an IntersectionObserver that sets a data attribute, is another, because CSS cannot gate a time-based animation on viewport intersection in every supported browser.

Violation: the same listener or observer used only to stick, dock, show, or hide an element that `position: sticky` or DOM placement would handle.
