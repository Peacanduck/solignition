import { NavLink } from 'react-router-dom'
import { useSearch } from '../lib/search-context'
import { Logo, SearchIcon, MenuIcon } from './icons'

interface Props {
  onOpenDrawer: () => void
}

export const DocsTopbar = ({ onOpenDrawer }: Props) => {
  const { open } = useSearch()
  return (
    <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md border-b border-line">
      <div className="flex items-center gap-4 md:gap-6 px-4 md:px-6 h-[49px] max-w-shell mx-auto">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="md:hidden text-ink-2 hover:text-ink p-1 -ml-1"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <a href="https://www.solignition.xyz/" className="flex items-center gap-2.5 shrink-0 text-ink no-underline">
          <span className="text-ink"><Logo /></span>
          <span className="font-semibold tracking-tight">solignition</span>
          <span className="font-mono text-ink-4 text-sm">/</span>
          <span className="font-mono text-[13px] text-ink-2">docs</span>
        </a>

        <button
          type="button"
          onClick={open}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded
                     border border-line-2 bg-bg-1 text-ink-3 text-[12px] font-mono
                     hover:border-line-3 transition-colors
                     w-full max-w-[320px]"
        >
          <SearchIcon />
          <span>Search docs...</span>
          <kbd className="ml-auto px-1.5 py-px text-[10px] border border-line-2 rounded bg-bg-2 hidden sm:inline">
            ⌘K
          </kbd>
        </button>

        <nav className="ml-auto hidden md:flex items-center gap-[18px] font-mono text-[12px] text-ink-2">
          <NavLink
            to="/get-started/intro"
            className={({ isActive }) =>
              isActive ? 'text-ink' : 'hover:text-ink transition-colors'
            }
          >
            Docs
          </NavLink>
          <NavLink to="/reference/program" className="hover:text-ink transition-colors">
            Reference
          </NavLink>
          <a
            href="https://github.com/Peacanduck/solignition/releases"
            className="hover:text-ink transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            Changelog
          </a>
          <a
            href="https://github.com/Peacanduck/solignition"
            className="hover:text-ink transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>

        <a
          href="https://app.solignition.xyz"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)]
                     px-3 py-1.5 font-mono text-[11px] font-medium text-black no-underline
                     hover:bg-[var(--accent-2)] transition-colors shrink-0"
        >
          app →
        </a>
      </div>
    </header>
  )
}
