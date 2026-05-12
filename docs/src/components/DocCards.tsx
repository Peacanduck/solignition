import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export const DocCards = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3 my-4">{children}</div>
)

interface CardProps {
  tag: string
  accent?: boolean
  title: string
  to: string
  linkLabel: string
  children: ReactNode
}

export const DocCard = ({ tag, accent, title, to, linkLabel, children }: CardProps) => (
  <Link
    to={to}
    className="block border border-line rounded-md p-4 bg-bg-1 hover:border-line-3
               transition-colors no-underline"
  >
    <div
      className={
        `inline-block font-mono text-[10px] tracking-[0.12em] px-1.5 py-0.5 ` +
        `border rounded mb-2.5 ` +
        (accent
          ? 'bg-[var(--accent-soft)] border-[var(--accent-edge)] text-[var(--accent)]'
          : 'border-line-2 text-ink-3')
      }
    >
      {tag}
    </div>
    <h3 className="text-[17px] font-semibold tracking-tight text-ink mb-2">{title}</h3>
    <p className="text-[13px] text-ink-2 mb-3">{children}</p>
    <span className="font-mono text-[11px] text-[var(--accent)]">{linkLabel} →</span>
  </Link>
)
