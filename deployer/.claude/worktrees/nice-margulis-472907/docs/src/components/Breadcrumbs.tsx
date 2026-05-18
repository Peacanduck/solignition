import { NAV_TREE } from '../content'

interface Props {
  slug: string
}

export const Breadcrumbs = ({ slug }: Props) => {
  const group = NAV_TREE.find(g => g.items.some(i => i.slug === slug))
  const item = group?.items.find(i => i.slug === slug)
  if (!group || !item) return null
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-ink-3 mb-3.5">
      <span>{group.section}</span>
      <span className="text-ink-4">›</span>
      <span className="text-[var(--accent)]">{item.title}</span>
    </div>
  )
}
