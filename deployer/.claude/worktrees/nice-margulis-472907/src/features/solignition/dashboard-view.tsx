import { Link } from 'react-router'
import { LoanState } from '@project/anchor'
import { address } from '@solana/kit'
import { useSolana } from '@/components/solana/use-solana'
import { WalletDropdown } from '@/components/wallet-dropdown'
import { AppExplorerLink } from '@/components/app-explorer-link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDepositorRecord } from './data-access/use-depositor-record'
import { useLoans, type LoanAccount } from './data-access/use-loans'
import { useVaultBalance } from './data-access/use-vault-balance'
import { useProtocolConfig } from './data-access/use-protocol-config'
import { useRepayLoanMutation } from './data-access/use-repay-loan-mutation'
import {
  calculateOwed,
  formatDuration,
  formatSOL,
  getRepaidTs,
  loanProgress,
  secondsLeft,
  shortAddr,
} from './lib/format'

export default function DashboardView() {
  const { account } = useSolana()

  if (!account) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          connect to see your portfolio
        </p>
        <WalletDropdown />
      </div>
    )
  }

  return <ConnectedDashboard accountAddress={account.address} />
}

function ConnectedDashboard({ accountAddress }: { accountAddress: string }) {
  const depositorQuery = useDepositorRecord(address(accountAddress))
  const loansQuery = useLoans(accountAddress)
  const vaultQuery = useVaultBalance()
  const configQuery = useProtocolConfig()

  const isLoading = depositorQuery.isLoading || loansQuery.isLoading
  const isError = depositorQuery.isError || loansQuery.isError

  if (isLoading) {
    return <DashSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load your portfolio</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{(loansQuery.error as Error)?.message ?? 'Network error'}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              depositorQuery.refetch()
              loansQuery.refetch()
            }}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const myLoans = loansQuery.data ?? []
  const activeLoans = myLoans.filter((l) => l.data.state === LoanState.Active)

  const record = depositorQuery.data?.data
  const depositedLamports = record?.depositedAmount ?? 0n
  const shareAmount = record?.shareAmount ?? 0n
  const vaultLamports = vaultQuery.data ?? 0n
  const totalShares = configQuery.data?.data.totalShares ?? 0n

  const sharePrice =
    totalShares > 0n ? Number(vaultLamports) / Number(totalShares) : 1
  const principalSol = Number(depositedLamports) / 1e9
  const currentValueSol = (Number(shareAmount) * sharePrice) / 1e9
  const earnedSol = currentValueSol - principalSol

  const utilization =
    configQuery.data?.data && vaultLamports + configQuery.data.data.totalLoansOutstanding > 0n
      ? Number(configQuery.data.data.totalLoansOutstanding) /
        (Number(configQuery.data.data.totalLoansOutstanding) + Number(vaultLamports))
      : 0
  const defaultRate = configQuery.data?.data.defaultInterestRateBps ?? 0
  const apyPct = (defaultRate / 100) * utilization // TODO: real APY when on-chain rate is annualized

  const totalOutstanding = activeLoans.reduce(
    (s, l) => s + calculateOwed(l),
    0n,
  )

  const alertLoan = pickAlertLoan(activeLoans)

  return (
    <div className="space-y-8">
      <DashHeader
        address={accountAddress}
        activeCount={activeLoans.length}
        deposited={principalSol}
        apy={apyPct}
        hasDeposit={shareAmount > 0n}
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 [&>*]:rounded-lg">
        <LPCard
          principal={principalSol}
          shareAmount={shareAmount}
          sharePrice={sharePrice}
          earned={earnedSol}
          vaultAvail={vaultLamports}
        />
        <EarningsCard
          earned={earnedSol}
          principal={principalSol}
          apy={apyPct}
          shareAmount={shareAmount}
          totalShares={totalShares}
        />

        <LoansCard
          loans={myLoans}
          activeCount={activeLoans.length}
          totalOutstanding={totalOutstanding}
        />

        <ActivityCard loans={myLoans} />
        {alertLoan ? (
          <AlertCard loan={alertLoan} />
        ) : (
          <div className="md:col-span-2" />
        )}
      </div>
    </div>
  )
}

function DashHeader({
  address,
  activeCount,
  deposited,
  apy,
  hasDeposit,
}: {
  address: string
  activeCount: number
  deposited: number
  apy: number
  hasDeposit: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          your portfolio · live
        </div>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-tight">
          gm, <span className="text-accent">{shortAddr(address)}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasDeposit
            ? `${activeCount} active loan${activeCount === 1 ? '' : 's'} · ${deposited.toFixed(3)} SOL deposited · earning ${apy.toFixed(2)}% apy`
            : `connect to deposit and start earning`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link to="/solignition/earn">+ deposit</Link>
        </Button>
        <Button asChild>
          <Link to="/solignition/borrow">+ new loan</Link>
        </Button>
      </div>
    </div>
  )
}

function LPCard({
  principal,
  shareAmount,
  sharePrice,
  earned,
  vaultAvail,
}: {
  principal: number
  shareAmount: bigint
  sharePrice: number
  earned: number
  vaultAvail: bigint
}) {
  const value = principal + earned
  const earnedPct = principal > 0 ? (earned / principal) * 100 : 0

  // TODO: real 30d sharePrice history (signature scan on vault PDA). For now, flat line.
  const w = 480
  const h = 96
  const flatY = h * 0.4

  return (
    <Card className="md:col-span-2 p-5">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              lp position
            </div>
            <div className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight">
              {value.toFixed(3)}{' '}
              <span className="text-base font-normal text-muted-foreground">SOL</span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {shareAmount.toLocaleString()} shares · share price {sharePrice.toFixed(4)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-accent tabular-nums">
              {earned >= 0 ? '+' : ''}
              {earned.toFixed(3)} SOL
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              earned · {earnedPct >= 0 ? '+' : ''}
              {earnedPct.toFixed(2)}% all-time
            </div>
          </div>
        </div>

        <div className="mt-4">
          <svg
            width="100%"
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="block"
          >
            <defs>
              <linearGradient id="lpgrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="oklch(0.78 0.17 150)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
              <line
                key={p}
                x1="0"
                x2={w}
                y1={p * h}
                y2={p * h}
                className="stroke-border"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
            ))}
            <path
              d={`M 0 ${flatY} L ${w} ${flatY} L ${w} ${h} L 0 ${h} Z`}
              fill="url(#lpgrad)"
            />
            <path
              d={`M 0 ${flatY} L ${w} ${flatY}`}
              className="stroke-accent"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx={w} cy={flatY} r="3" className="fill-accent" />
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>30d ago</span>
            <span>20d</span>
            <span>10d</span>
            <span>now</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link to="/solignition/earn">+ deposit more</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/solignition/earn">− withdraw</Link>
          </Button>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            vault: {formatSOL(vaultAvail, 0)} SOL avail
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function EarningsCard({
  earned,
  principal,
  apy,
  shareAmount,
  totalShares,
}: {
  earned: number
  principal: number
  apy: number
  shareAmount: bigint
  totalShares: bigint
}) {
  const sharePct =
    totalShares > 0n ? (Number(shareAmount) / Number(totalShares)) * 100 : 0
  const allBarPct = principal > 0 ? Math.min(100, Math.abs(earned / principal) * 1000) : 0

  if (principal === 0) {
    return (
      <Card className="p-5">
        <CardContent className="p-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            earnings
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            make your first deposit to start earning →
          </div>
          <Button asChild size="sm" className="mt-3">
            <Link to="/solignition/earn">+ deposit</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="p-5">
      <CardContent className="p-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          earnings
        </div>
        <div className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight">
          {earned >= 0 ? '+' : ''}
          {earned.toFixed(3)}{' '}
          <span className="text-base font-normal text-muted-foreground">SOL</span>
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          since first deposit
        </div>

        <div className="mt-4 space-y-2">
          {/* TODO: 24h/7d/30d windows need on-chain history */}
          {(['24h', '7d', '30d'] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-8 font-mono text-[10px] text-muted-foreground">{k}</span>
              <div className="h-1 flex-1 rounded bg-secondary" />
              <span className="font-mono text-[10px] text-muted-foreground">—</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-8 font-mono text-[10px] text-muted-foreground">all</span>
            <div className="h-1 flex-1 rounded bg-secondary">
              <div
                className="h-full rounded bg-accent"
                style={{ width: `${allBarPct}%` }}
              />
            </div>
            <span className="font-mono text-xs font-semibold text-accent tabular-nums">
              {earned >= 0 ? '+' : ''}
              {earned.toFixed(3)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-between font-mono text-xs">
          <div>
            <span className="text-muted-foreground">est. apy</span>{' '}
            <span className="font-semibold text-accent">{apy.toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">your share</span>{' '}
            <span>{sharePct.toFixed(2)}% of pool</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoansCard({
  loans,
  activeCount,
  totalOutstanding,
}: {
  loans: LoanAccount[]
  activeCount: number
  totalOutstanding: bigint
}) {
  if (loans.length === 0) {
    return (
      <Card className="md:col-span-3 p-5">
        <CardContent className="p-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            my loans
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            no loans yet ·{' '}
            <Link to="/solignition/borrow" className="text-accent underline-offset-2 hover:underline">
              request your first loan →
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="md:col-span-3 p-5">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              my loans
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {loans.length} total · {activeCount} active · {formatSOL(totalOutstanding, 3)} SOL outstanding
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/solignition/borrow">+ new loan</Link>
          </Button>
        </div>

        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                loan
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                program
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                principal
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                rate
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                owed
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                progress
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                state
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <LoanRow key={loan.address} loan={loan} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LoanRow({ loan }: { loan: LoanAccount }) {
  const owed = calculateOwed(loan)
  const progress = loanProgress(loan)
  const left = secondsLeft(loan)
  const isActive = loan.data.state === LoanState.Active
  const isRepaid =
    loan.data.state === LoanState.Repaid ||
    loan.data.state === LoanState.RepaidPendingTransfer
  const isWarn = isActive && left > 0n && left < BigInt(7 * 86400)
  const stateLabel = LOAN_STATE_LABELS[loan.data.state] ?? 'unknown'

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        #{loan.data.loanId.toString()}
      </TableCell>
      <TableCell className="font-mono text-xs text-accent">
        {shortAddr(loan.data.programPubkey)}
      </TableCell>
      <TableCell className="font-mono text-sm tabular-nums">
        {formatSOL(loan.data.principal, 3)} SOL
      </TableCell>
      <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
        {(loan.data.interestRateBps / 100).toFixed(1)}%
      </TableCell>
      <TableCell className="font-mono text-sm font-medium tabular-nums">
        {formatSOL(owed, 3)} SOL
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1 w-24 rounded bg-secondary">
            <div
              className={`h-full rounded ${
                isRepaid ? 'bg-muted-foreground' : isWarn ? 'bg-warn' : 'bg-accent'
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {isRepaid ? '✓ repaid' : formatDuration(left)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive ? 'bg-accent animate-pulse' : isRepaid ? 'bg-muted-foreground' : 'bg-warn'
            }`}
          />
          {stateLabel}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <RowAction loan={loan} isActive={isActive} isWarn={isWarn} />
      </TableCell>
    </TableRow>
  )
}

const LOAN_STATE_LABELS: Record<number, string> = {
  [LoanState.Active]: 'active',
  [LoanState.Repaid]: 'repaid',
  [LoanState.Recovered]: 'recovered',
  [LoanState.Pending]: 'pending',
  [LoanState.RepaidPendingTransfer]: 'transfer',
  [LoanState.Reclaimed]: 'reclaimed',
}

function RowAction({
  loan,
  isActive,
  isWarn,
}: {
  loan: LoanAccount
  isActive: boolean
  isWarn: boolean
}) {
  const { account } = useSolana()
  const repay = useRepayLoanMutation({ account: account! })

  if (!isActive) {
    return (
      <AppExplorerLink
        address={loan.address}
        label="view"
        className="font-mono text-xs text-muted-foreground hover:text-foreground"
      />
    )
  }

  return (
    <Button
      variant={isWarn ? 'default' : 'ghost'}
      size="sm"
      className="font-mono text-xs"
      disabled={repay.isPending}
      onClick={() =>
        repay.mutateAsync({
          loanAddress: loan.address,
          programData: loan.data.programPubkey,
          loanId: loan.data.loanId,
        })
      }
    >
      {repay.isPending ? '…' : isWarn ? 'repay →' : 'manage'}
    </Button>
  )
}

function ActivityCard({ loans }: { loans: LoanAccount[] }) {
  type Event = { kind: 'loan' | 'repaid'; loanId: bigint; amountLamports: bigint; ts: bigint }
  const events: Event[] = []
  for (const l of loans) {
    events.push({
      kind: 'loan',
      loanId: l.data.loanId,
      amountLamports: l.data.principal,
      ts: l.data.startTs,
    })
    const repaidTs = getRepaidTs(l)
    if (repaidTs) {
      events.push({
        kind: 'repaid',
        loanId: l.data.loanId,
        amountLamports: calculateOwed(l, repaidTs),
        ts: repaidTs,
      })
    }
  }
  events.sort((a, b) => Number(b.ts - a.ts))
  const top = events.slice(0, 5)

  return (
    <Card className="p-5">
      <CardContent className="space-y-3 p-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            activity
          </div>
          {/* TODO: real activity feed via signature subscription */}
        </div>
        {top.length === 0 ? (
          <div className="text-sm text-muted-foreground">no activity yet</div>
        ) : (
          <div className="space-y-2">
            {top.map((e, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    e.kind === 'repaid' ? 'bg-accent/15 text-accent' : 'bg-secondary text-foreground'
                  }`}
                >
                  {e.kind === 'repaid' ? '✓ repaid' : '↗ loan'}
                </span>
                <span className="flex-1">
                  #{e.loanId.toString()} · {formatSOL(e.amountLamports, 3)} SOL
                </span>
                <span className="text-[10px] text-muted-foreground">{relativeTime(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AlertCard({ loan }: { loan: LoanAccount }) {
  const { account } = useSolana()
  const repay = useRepayLoanMutation({ account: account! })
  const left = secondsLeft(loan)
  const owed = calculateOwed(loan)

  return (
    <Card className="md:col-span-2 border-warn/50 p-5">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
          <span>⚠</span>
          heads up · loan #{loan.data.loanId.toString()}
        </div>
        <div className="mt-2 text-sm">
          Loan{' '}
          <span className="font-mono">#{loan.data.loanId.toString()}</span> expires in{' '}
          <strong>{formatDuration(left)}</strong>. Repay{' '}
          <span className="font-mono">{formatSOL(owed, 3)} SOL</span> to claim upgrade authority,
          or the protocol will recover the program.
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            disabled={repay.isPending}
            onClick={() =>
              repay.mutateAsync({
                loanAddress: loan.address,
                programData: loan.data.programPubkey,
                loanId: loan.data.loanId,
              })
            }
          >
            {repay.isPending ? '…' : `repay ${formatSOL(owed, 3)} SOL →`}
          </Button>
          <Button variant="ghost" disabled>
            extend term
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function pickAlertLoan(active: LoanAccount[]): LoanAccount | null {
  const candidates = active
    .map((l) => ({ loan: l, left: secondsLeft(l) }))
    .filter((x) => x.left > 0n && x.left < BigInt(5 * 86400))
  if (candidates.length === 0) return null
  candidates.sort((a, b) => Number(a.left - b.left))
  return candidates[0].loan
}

function relativeTime(tsSec: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const diff = now > tsSec ? now - tsSec : 0n
  const s = Number(diff)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function DashSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Card className="md:col-span-2 p-5">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </Card>
        <Card className="p-5">
          <div className="h-40 animate-pulse rounded bg-muted" />
        </Card>
        <Card className="md:col-span-3 p-5">
          <div className="h-32 animate-pulse rounded bg-muted" />
        </Card>
      </div>
    </div>
  )
}
