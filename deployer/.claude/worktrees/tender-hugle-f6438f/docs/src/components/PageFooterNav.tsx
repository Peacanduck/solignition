import { Link } from 'react-router-dom'
import { NAV_TREE } from '../content'

const FLAT = NAV_TREE.flatMap(g => g.items)

interface Props {
  slug: string
}

export const PageFooterNav = ({ slug }: Props) => {
  const i = FLAT.findIndex(p => p.slug === slug)
  if (i < 0) return null
  const prev = i > 0 ? FLAT[i - 1] : null
  const next = i < FLAT.length - 1 ? FLAT[i + 1] : null

  return (
    <div className="flex justify-between mt-12 mb-4 pt-6 border-t border-line gap-4">
      {prev ? (
        <Link
          to={prev.slug}
          className="flex flex-col gap-1 px-3.5 py-2 border border-line rounded
                     text-ink no-underline hover:border-line-3 transition-colors"
        >
          <span className="font-mono text-[10px] text-ink-3">← previous</span>
          <span className="text-[12px]">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          to={next.slug}
          className="flex flex-col gap-1 px-3.5 py-2 border border-line rounded
                     text-right text-ink no-underline hover:border-line-3 transition-colors"
        >
          <span className="font-mono text-[10px] text-ink-3">next →</span>
          <span className="text-[12px]">{next.title}</span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}
