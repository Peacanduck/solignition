import { Link, NavLink, useLocation } from 'react-router'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { ClusterDropdown } from '@/components/cluster-dropdown'
import { ThemeSelect } from '@/components/theme-select'
import { WalletDropdown } from '@/components/wallet-dropdown'
import { useSolana } from '@/components/solana/use-solana'

const TABS = [
  { to: '/solignition/explore', label: 'explore' },
  { to: '/solignition/borrow', label: 'borrow' },
  { to: '/solignition/earn', label: 'earn' },
  { to: '/solignition/dashboard', label: 'dashboard' },
] as const

function NetBadge() {
  const { cluster } = useSolana()
  const id = cluster?.id ?? ''
  const tone = id.includes('mainnet')
    ? 'text-destructive border-destructive/40'
    : id.includes('testnet')
      ? 'text-warn border-warn/40'
      : 'text-accent border-accent/40'
  const dotTone = id.includes('mainnet')
    ? 'bg-destructive'
    : id.includes('testnet')
      ? 'bg-warn'
      : 'bg-accent'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotTone} animate-pulse`} />
      {cluster?.label ?? 'unknown'}
    </span>
  )
}

export function TopNav() {
  const { pathname } = useLocation()
  const showTabs = pathname === '/' || pathname.startsWith('/solignition')

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="flex items-center gap-4 px-6 py-3">
        <Brand />
        <NetBadge />
        {showTabs ? (
          <nav className="mx-auto flex gap-1 rounded-md border bg-card p-1">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `rounded px-3.5 py-1.5 font-mono text-xs transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        ) : (
          <div className="flex-1" />
        )}
        <Button variant="ghost" asChild className="font-mono text-xs">
          <Link to="/account">account</Link>
        </Button>
        <ThemeSelect />
        <ClusterDropdown />
        <WalletDropdown />
      </div>
    </header>
  )
}
