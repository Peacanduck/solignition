import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DocsSidebar } from './DocsSidebar'
import { CloseIcon } from './icons'

interface Props {
  open: boolean
  onClose: () => void
}

export const MobileDrawer = ({ open, onClose }: Props) => {
  const location = useLocation()

  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        aria-label="Close menu"
      />
      <div className="relative h-full w-[280px] bg-bg-1 border-r border-line overflow-y-auto scroll-thin">
        <div className="flex items-center justify-between px-4 h-[49px] border-b border-line">
          <span className="font-mono text-[12px] text-ink-2">menu</span>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink p-1 -mr-1"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <DocsSidebar variant="drawer" onNavigate={onClose} />

        <div className="px-4 py-3 border-t border-line">
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-3 mb-2">
            Top nav
          </div>
          <div className="flex flex-col gap-2 font-mono text-[12px]">
            <Link to="/reference/program" onClick={onClose} className="text-ink-2 hover:text-ink no-underline">
              Reference
            </Link>
            <a
              href="https://github.com/Peacanduck/solignition/releases"
              target="_blank"
              rel="noreferrer"
              className="text-ink-2 hover:text-ink no-underline"
            >
              Changelog
            </a>
            <a
              href="https://github.com/Peacanduck/solignition"
              target="_blank"
              rel="noreferrer"
              className="text-ink-2 hover:text-ink no-underline"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
