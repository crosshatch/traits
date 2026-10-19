import { InstallCommand } from "./InstallCommand.tsx"
import { ThemeToggle } from "./ThemeToggle.tsx"

export const ActionBar = (props: { readonly docked?: boolean | undefined }) => {
  const Tag = props.docked === true ? "footer" : "header"
  return (
    <Tag className={props.docked === true ? "masthead docked-header" : "masthead"}>
      <a className="brand" href="#top" aria-label="Traits, back to top">
        <img className="emblem" src="/traits-mark.svg" width="48" height="48" alt="" />
        <span>TRAITS</span>
      </a>
      {props.docked === true && <InstallCommand compact />}
      <nav aria-label={props.docked === true ? "Bottom navigation" : "Main navigation"}>
        <a
          className="source-link"
          href="https://github.com/crosshatch/traits"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Source on GitHub (opens in a new tab)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.791-1.508-3.791-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.023-.7.078-.686.078-.686 1.13.08 1.725 1.16 1.725 1.16 1.005 1.723 2.637 1.225 3.278.937.103-.728.393-1.225.715-1.507-2.498-.284-5.124-1.249-5.124-5.56 0-1.228.44-2.233 1.16-3.02-.116-.284-.503-1.429.11-2.978 0 0 .945-.303 3.095 1.153A10.8 10.8 0 0 1 12 6.183c.956.004 1.919.13 2.818.379 2.149-1.456 3.092-1.153 3.092-1.153.615 1.55.228 2.694.112 2.978.722.787 1.158 1.792 1.158 3.02 0 4.322-2.63 5.273-5.136 5.552.404.35.765 1.042.765 2.1 0 1.517-.014 2.74-.014 3.112 0 .3.203.65.774.54A11.25 11.25 0 0 0 12 .75Z" />
          </svg>
          <span aria-hidden="true">↗&#xfe0e;</span>
        </a>
        <ThemeToggle />
        <a
          className="social-link"
          href="https://x.com/CrosshatchDev"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Crosshatch Labs on X (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.2-8.3L1.8 2h6.5l4.5 6.8Zm-1.1 18h1.7L7.4 3.9H5.6Z" />
          </svg>
          <span aria-hidden="true">↗&#xfe0e;</span>
        </a>
      </nav>
    </Tag>
  )
}
