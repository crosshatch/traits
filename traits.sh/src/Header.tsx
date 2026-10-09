import { ThemeToggle } from "./ThemeToggle.tsx"

export const Header = (props: { readonly docked?: boolean | undefined }) => {
  const Tag = props.docked === true ? "footer" : "header"
  return (
    <Tag className={props.docked === true ? "masthead docked-header" : "masthead"}>
      <a className="brand" href="#top" aria-label="Traits, back to top">
        <img className="emblem" src="/traits-mark.svg" width="48" height="48" alt="" />
        <span>TRAITS</span>
      </a>
      <nav aria-label={props.docked === true ? "Bottom navigation" : "Main navigation"}>
        <a className="source-link" href="https://github.com/crosshatch/traits">
          Source <span aria-hidden="true">↗</span>
        </a>
        <ThemeToggle />
        <a
          className="social-link"
          href="https://x.com/harrysolovay"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Harry Solovay on X (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.2-8.3L1.8 2h6.5l4.5 6.8Zm-1.1 18h1.7L7.4 3.9H5.6Z" />
          </svg>
          <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </Tag>
  )
}
