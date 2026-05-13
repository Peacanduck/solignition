import { useEffect, type ReactNode } from 'react'
import { DocsTOC, type TOCEntry } from './DocsTOC'
import { PageFooterNav } from './PageFooterNav'
import { Breadcrumbs } from './Breadcrumbs'
import { PAGES } from '../content'

interface Props {
  slug: string
  headings: TOCEntry[]
  children: ReactNode
}

const RECENTS_KEY = 'solignition.docs.recent'
const MAX_RECENTS = 10

export const DocsArticle = ({ slug, headings, children }: Props) => {
  useEffect(() => {
    const meta = PAGES[slug]
    if (!meta) return
    try {
      const cur = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as Array<{
        slug: string
        title: string
        ts: number
      }>
      const next = [
        { slug, title: meta.title, ts: Date.now() },
        ...cur.filter(r => r.slug !== slug),
      ].slice(0, MAX_RECENTS)
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota / private mode */
    }
  }, [slug])

  return (
    <>
      <article className="min-w-0 max-w-article">
        <Breadcrumbs slug={slug} />
        <div className="prose-doc">{children}</div>
        <PageFooterNav slug={slug} />
        <ArticleFootRow slug={slug} />
      </article>
      <DocsTOC headings={headings} />
    </>
  )
}

const ArticleFootRow = ({ slug }: { slug: string }) => (
  <div className="flex items-center gap-3 py-4 font-mono text-[11px] text-ink-3">
    <a
      href={`https://github.com/Peacanduck/solignition/edit/main/docs/src/content${slug}.mdx`}
      target="_blank"
      rel="noreferrer"
      className="hover:text-ink no-underline"
    >
      Edit this page on GitHub ↗
    </a>
    <span className="text-ink-4">·</span>
    <span>Was this helpful?</span>
    <button type="button" className="opacity-60 hover:opacity-100" aria-label="Helpful">
      👍
    </button>
    <button type="button" className="opacity-60 hover:opacity-100" aria-label="Not helpful">
      👎
    </button>
  </div>
)
