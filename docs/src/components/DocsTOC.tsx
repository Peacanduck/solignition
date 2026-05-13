import { useScrollSpy } from '../lib/use-scroll-spy'

export interface TOCEntry {
  id: string
  label: string
}

interface Props {
  headings: TOCEntry[]
}

export const DocsTOC = ({ headings }: Props) => {
  const ids = headings.map(h => h.id)
  const activeId = useScrollSpy(ids, { offset: 80 })

  return (
    <aside className="sticky top-20 self-start max-[1100px]:hidden">
      <div className="pl-4 border-l border-line flex flex-col gap-1">
        {headings.length > 0 && (
          <>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 mb-2">
              On this page
            </div>
            {headings.map(h => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={
                  `text-[12px] py-0.5 transition-colors no-underline ` +
                  (activeId === h.id ? 'text-[var(--accent)]' : 'text-ink-3 hover:text-ink')
                }
              >
                {h.label}
              </a>
            ))}
            <div className="h-px bg-line my-[18px]" />
          </>
        )}

        <div className="flex flex-col gap-1">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 mb-2">
            Need help?
          </div>
          <a
            className="text-[12px] text-ink-3 hover:text-ink no-underline"
            href="https://discord.gg/7yBEb7GUee"
            target="_blank"
            rel="noreferrer"
          >
            → Discord
          </a>
          <a
            className="text-[12px] text-ink-3 hover:text-ink no-underline"
            href="https://github.com/Peacanduck/solignition/issues"
            target="_blank"
            rel="noreferrer"
          >
            → Open an issue
          </a>
          <a
            className="text-[12px] text-ink-3 hover:text-ink no-underline"
            href="mailto:solignition@protonmail.com"
          >
            → Email support
          </a>
        </div>
      </div>
    </aside>
  )
}
