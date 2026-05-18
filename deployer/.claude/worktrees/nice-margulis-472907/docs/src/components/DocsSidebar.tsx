import { NavLink } from 'react-router-dom'
import { NAV_TREE } from '../content'

interface Props {
  variant?: 'rail' | 'drawer'
  onNavigate?: () => void
}

export const DocsSidebar = ({ variant = 'rail', onNavigate }: Props) => {
  const wrapper =
    variant === 'rail'
      ? 'border-r border-line sticky top-[49px] self-start ' +
        'h-[calc(100vh-49px)] overflow-y-auto scroll-thin max-md:hidden'
      : 'block'

  return (
    <aside className={wrapper}>
      <div className="px-4 pt-7 pb-16">
        {NAV_TREE.map(group => (
          <div key={group.section} className="mb-[22px]">
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 px-2.5 mb-2">
              {group.section}
            </div>
            {group.items.map(item => (
              <NavLink
                key={item.slug}
                to={item.slug}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block w-full text-left px-3 py-1.5 text-[13px] rounded-r ` +
                  `border-l-2 transition-colors duration-100 no-underline ` +
                  (isActive
                    ? 'text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-ink-2 border-transparent hover:text-ink hover:bg-bg-1')
                }
              >
                {item.title}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
