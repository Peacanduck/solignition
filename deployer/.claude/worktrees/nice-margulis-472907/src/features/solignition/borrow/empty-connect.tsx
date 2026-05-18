import { Card, CardContent } from '@/components/ui/card'
import { WalletDropdown } from '@/components/wallet-dropdown'

export function EmptyConnect() {
  return (
    <Card className="mx-auto max-w-2xl p-10">
      <CardContent className="flex flex-col items-center gap-5 p-0 text-center">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect
            x="8"
            y="20"
            width="48"
            height="32"
            rx="4"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path
            d="M22 32 L42 32 M22 38 L34 38"
            className="stroke-muted-foreground"
            strokeWidth="1.5"
          />
          <circle cx="50" cy="20" r="6" className="fill-accent" />
          <path
            d="M48 20 L50 22 L53 18"
            className="stroke-background"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
        <h2 className="font-mono text-3xl font-semibold tracking-tight">
          connect a wallet to begin.
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          You'll need to sign one transaction to request a loan and authorize deployment. We
          don't hold your keys.
        </p>
        <WalletDropdown />
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>supported:</span>
          <span>Phantom</span>
          <span>·</span>
          <span>Solflare</span>
          <span>·</span>
          <span>Backpack</span>
          <span>·</span>
          <span>Ledger</span>
        </div>
      </CardContent>
    </Card>
  )
}
