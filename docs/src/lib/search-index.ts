import Fuse from 'fuse.js'
import { PAGES } from '../content'

export interface SearchEntry {
  slug: string
  anchor: string
  label: string
  snippet: string
  title: string
}

const chunk = (s: string, size: number) => {
  const out: string[] = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}

const ENTRIES: SearchEntry[] = Object.values(PAGES).flatMap(p => [
  {
    slug: p.slug,
    anchor: '',
    label: p.title,
    snippet: p.description ?? '',
    title: p.title,
  },
  ...p.headings.map(h => ({
    slug: p.slug,
    anchor: `#${h.id}`,
    label: h.label,
    snippet: '',
    title: p.title,
  })),
  ...chunk(p.rawText, 250).map(snippet => ({
    slug: p.slug,
    anchor: '',
    label: p.title,
    snippet,
    title: p.title,
  })),
])

export const fuse = new Fuse(ENTRIES, {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'label', weight: 2 },
    { name: 'snippet', weight: 1 },
  ],
  includeMatches: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  ignoreLocation: true,
})

export const search = (q: string, limit = 20) =>
  q.trim().length < 2 ? [] : fuse.search(q, { limit })
