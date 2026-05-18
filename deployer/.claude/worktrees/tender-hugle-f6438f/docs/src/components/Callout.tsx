import type { ReactNode } from 'react'

type Kind = 'tldr' | 'warn' | 'info'

interface Style {
  wrap: string
  bar: string
  strong: string
}

const STYLES: Record<Kind, Style> = {
  tldr: {
    wrap: 'bg-[var(--accent-soft)] border-[var(--accent-edge)]',
    bar: 'bg-[var(--accent)]',
    strong: 'text-[var(--accent)]',
  },
  warn: {
    wrap: 'bg-[oklch(0.3_0.07_75/0.18)] border-[oklch(0.5_0.12_75/0.4)]',
    bar: 'bg-[var(--warn)]',
    strong: 'text-[var(--warn)]',
  },
  info: {
    wrap: 'bg-bg-1 border-line-2',
    bar: 'bg-line-3',
    strong: 'text-ink',
  },
}

interface Props {
  kind?: Kind
  children: ReactNode
}

export const Callout = ({ kind = 'info', children }: Props) => {
  const s = STYLES[kind]
  return (
    <div className={`flex rounded-md overflow-hidden border my-5 ${s.wrap}`}>
      <div className={`w-[3px] flex-shrink-0 ${s.bar}`} />
      <div
        className={`px-4 py-3.5 text-[14px] leading-[1.6] text-ink-2 [&_strong]:font-semibold [&_strong]:${s.strong}`}
      >
        {children}
      </div>
    </div>
  )
}
