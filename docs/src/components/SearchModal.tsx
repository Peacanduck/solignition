import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../lib/search-context'
import { search } from '../lib/search-index'
import { SearchIcon } from './icons'

const RECENTS_KEY = 'solignition.docs.recent'

interface RecentEntry {
  slug: string
  title: string
  ts: number
}

const readRecents = (): RecentEntry[] => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentEntry[]
  } catch {
    return []
  }
}

export const SearchModal = () => {
  const { isOpen, close } = useSearch()
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => {
    const raw = search(q)
    const seen = new Set<string>()
    const deduped: typeof raw = []
    for (const r of raw) {
      const key = r.item.slug + r.item.anchor
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(r)
    }
    return deduped.slice(0, 10)
  }, [q])

  const recents = useMemo(() => (isOpen ? readRecents().slice(0, 5) : []), [isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    setActiveIdx(0)
  }, [q])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen) return null

  const select = (i: number) => {
    const hit = hits[i]
    if (!hit) return
    navigate(hit.item.slug + hit.item.anchor)
    close()
    setQ('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(activeIdx)
    }
  }

  const showHits = q.trim().length >= 2
  const showEmpty = showHits && hits.length === 0
  const showRecents = !showHits && recents.length > 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="mx-auto mt-[10vh] w-[calc(100%-32px)] max-w-[640px] rounded-lg
                   border border-line-2 bg-bg-1 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <span className="text-ink-3">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search docs..."
            className="flex-1 bg-transparent outline-none text-[14px] text-ink placeholder:text-ink-3"
          />
          <kbd className="font-mono text-[10px] text-ink-3 px-1.5 py-px border border-line-2 rounded bg-bg-2">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scroll-thin">
          {showRecents && (
            <>
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 px-3 py-2">
                Recent
              </div>
              {recents.map(r => (
                <button
                  key={r.slug}
                  type="button"
                  onClick={() => {
                    navigate(r.slug)
                    close()
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-2 transition-colors flex flex-col gap-0.5"
                >
                  <span className="text-[14px] text-ink">{r.title}</span>
                  <span className="font-mono text-[10px] text-ink-4">{r.slug}</span>
                </button>
              ))}
            </>
          )}

          {!showHits && recents.length === 0 && (
            <div className="px-3 py-6 text-center font-mono text-[12px] text-ink-3">
              type to search the docs
            </div>
          )}

          {showEmpty && (
            <div className="px-3 py-6 text-center font-mono text-[12px] text-ink-3">
              no matches for &quot;{q}&quot;
              <div className="mt-2">
                <a
                  className="text-[var(--accent)] hover:underline"
                  href="https://github.com/Peacanduck/solignition/issues/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  report missing doc →
                </a>
              </div>
            </div>
          )}

          {showHits &&
            hits.map((h, i) => (
              <button
                key={h.item.slug + h.item.anchor + i}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => select(i)}
                className={
                  `w-full text-left px-3 py-2.5 rounded-md flex flex-col gap-0.5 transition-colors ` +
                  (i === activeIdx
                    ? 'bg-[var(--accent-soft)] border border-[var(--accent-edge)]'
                    : 'border border-transparent hover:bg-bg-2')
                }
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-ink">{h.item.label}</span>
                  {h.item.anchor && (
                    <span className="font-mono text-[10px] text-ink-3">in {h.item.title}</span>
                  )}
                </div>
                {h.item.snippet && (
                  <div className="text-[12px] text-ink-3 line-clamp-1">{h.item.snippet}</div>
                )}
                <div className="font-mono text-[10px] text-ink-4">
                  {h.item.slug}
                  {h.item.anchor}
                </div>
              </button>
            ))}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-line font-mono text-[10px] text-ink-3">
          <kbd className="px-1.5 py-px border border-line-2 rounded bg-bg-2">↑↓</kbd> navigate
          <kbd className="px-1.5 py-px border border-line-2 rounded bg-bg-2">↵</kbd> open
          <kbd className="px-1.5 py-px border border-line-2 rounded bg-bg-2">esc</kbd> close
        </div>
      </div>
    </div>
  )
}
