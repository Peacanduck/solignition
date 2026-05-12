import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DocsTopbar } from './DocsTopbar'
import { DocsSidebar } from './DocsSidebar'
import { MobileDrawer } from './MobileDrawer'

export const DocsLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg)] text-ink">
      <DocsTopbar onOpenDrawer={() => setDrawerOpen(true)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="grid grid-cols-shell max-w-shell mx-auto max-md:grid-cols-1">
        <DocsSidebar />
        <main
          className="grid grid-cols-main-toc gap-12 px-12 py-10
                     max-[1100px]:grid-cols-1 max-[1100px]:gap-6
                     max-md:px-6 max-md:py-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
