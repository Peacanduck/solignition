import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LoanState } from '@project/anchor'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AppExplorerLink } from '@/components/app-explorer-link'
import { useLoans, type LoanAccount } from './data-access/use-loans'
import { useProtocolConfig } from './data-access/use-protocol-config'
import { useVaultBalance } from './data-access/use-vault-balance'
import {
  calculateOwed,
  formatDuration,
  formatSOL,
  loanProgress,
  secondsLeft,
  shortAddr,
} from './lib/format'

const PAGE_SIZE = 12
const NINETY_DAYS_SEC = BigInt(90 * 86400)

type FilterKey = 'all' | 'active' | 'repaid' | 'recovered'

const FILTER_TO_STATE: Record<Exclude<FilterKey, 'all'>, number> = {
  active: LoanState.Active,
  repaid: LoanState.Repaid,
  recovered: LoanState.Recovered,
}

export default function ExploreView() {
  const loansQuery = useLoans()
  const configQuery = useProtocolConfig()
  const vaultQuery = useVaultBalance()

  if (loansQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load the protocol</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{(loansQuery.error as Error)?.message ?? 'Network error'}</span>
          <Button variant="outline" size="sm" onClick={() => loansQuery.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const loading = loansQuery.isLoading || configQuery.isLoading
  const loans = loansQuery.data ?? []

  const totalLoansOutstanding = configQuery.data?.data.totalLoansOutstanding ?? 0n
  const vaultLamports = vaultQuery.data ?? 0n
  const tvl = vaultLamports + totalLoansOutstanding
  const utilizationPct = tvl > 0n ? (Number(totalLoansOutstanding) / Number(tvl)) * 100 : 0
  const defaultRate = configQuery.data?.data.defaultInterestRateBps ?? 0
  const apyPct = (defaultRate / 100) * (utilizationPct / 100) // TODO: needs annualized rate

  const stateCounts = useMemo(() => countByState(loans), [loans])
  const defaultPct = useMemo(() => computeDefaultRate(loans), [loans])

  return (
    <div className="space-y-8">
      <ExploreHeader
        loanCount={loans.length}
        activeCount={stateCounts.active}
        tvl={tvl}
        empty={!loading && loans.length === 0}
      />

      <StatsStrip
        loading={loading}
        tvl={tvl}
        utilizationPct={utilizationPct}
        apyPct={apyPct}
        loanCounter={Number(configQuery.data?.data.loanCounter ?? 0n)}
        activeCount={stateCounts.active}
        repaidCount={stateCounts.repaid}
        defaultPct={defaultPct}
      />

      {loading ? (
        <Skeletons />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_360px]">
          <LoansPanel loans={loans} />
          <Leaderboard loans={loans} />
        </div>
      )}
    </div>
  )
}

function ExploreHeader({
  loanCount,
  activeCount,
  tvl,
  empty,
}: {
  loanCount: number
  activeCount: number
  tvl: bigint
  empty: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          public protocol · live
        </div>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-tight">
          explore the pool.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {empty
            ? 'no loans yet · be the first to deploy'
            : `${loanCount} loan${loanCount === 1 ? '' : 's'} · ${activeCount} active · ${formatSOL(tvl, 1)} SOL TVL`}
        </p>
      </div>
      <Button asChild>
        <Link to="/solignition/borrow">+ new loan</Link>
      </Button>
    </div>
  )
}

function StatsStrip({
  loading,
  tvl,
  utilizationPct,
  apyPct,
  loanCounter,
  activeCount,
  repaidCount,
  defaultPct,
}: {
  loading: boolean
  tvl: bigint
  utilizationPct: number
  apyPct: number
  loanCounter: number
  activeCount: number
  repaidCount: number
  defaultPct: number | null
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-24 animate-pulse rounded bg-muted" />
          </Card>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-5">
      <StatCard label="tvl" value={formatSOL(tvl, 1)} unit="SOL" />
      <StatCard label="utilization" value={utilizationPct.toFixed(1)} unit="%" />
      <StatCard label="avg apy" value={apyPct.toFixed(2)} unit="%" />
      <StatCard
        label="deployed"
        value={loanCounter.toString()}
        sub={`${activeCount} active · ${repaidCount} repaid`}
      />
      <StatCard
        label="default rate · 90d"
        value={defaultPct === null ? '—' : defaultPct.toFixed(1)}
        unit={defaultPct === null ? undefined : '%'}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit?: string
  sub?: string
}) {
  return (
    <Card className="p-5">
      <CardContent className="space-y-2 p-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          {/* TODO: real 24h delta arrows once snapshot table exists */}
          <span className="font-mono text-[10px] text-muted-foreground">—</span>
        </div>
        <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {value}
          {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
        </div>
        {sub ? <div className="font-mono text-[11px] text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  )
}

function LoansPanel({ loans }: { loans: LoanAccount[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const sorted = [...loans].sort((a, b) => Number(b.data.loanId - a.data.loanId))
    if (filter === 'all') return sorted
    const target = FILTER_TO_STATE[filter]
    return sorted.filter((l) => l.data.state === target)
  }, [loans, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const onFilter = (v: string) => {
    setFilter(v as FilterKey)
    setPage(0)
  }

  return (
    <Card className="p-5">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            all loans
          </div>
          <Tabs value={filter} onValueChange={onFilter}>
            <TabsList className="h-8 bg-secondary">
              <TabsTrigger value="all" className="px-3 font-mono text-xs">
                all
              </TabsTrigger>
              <TabsTrigger value="active" className="px-3 font-mono text-xs">
                active
              </TabsTrigger>
              <TabsTrigger value="repaid" className="px-3 font-mono text-xs">
                repaid
              </TabsTrigger>
              <TabsTrigger value="recovered" className="px-3 font-mono text-xs">
                recovered
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            no loans match this filter
          </div>
        ) : (
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                {['loan', 'borrower', 'program', 'principal', 'rate', 'owed', 'progress', 'state', ''].map((h, i) => (
                  <TableHead
                    key={i}
                    className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* TODO: row expansion for full details — explorer links below cover the practical case for now */}
              {paged.map((loan) => (
                <ExploreLoanRow key={loan.address} loan={loan} />
              ))}
            </TableBody>
          </Table>
        )}

        {filtered.length > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              ← prev
            </Button>
            <span>
              page {safePage + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              next →
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
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

function ExploreLoanRow({ loan }: { loan: LoanAccount }) {
  const owed = calculateOwed(loan)
  const progress = loanProgress(loan)
  const left = secondsLeft(loan)
  const isActive = loan.data.state === LoanState.Active
  const isRepaid =
    loan.data.state === LoanState.Repaid ||
    loan.data.state === LoanState.RepaidPendingTransfer
  const isRecovered = loan.data.state === LoanState.Recovered
  const isWarn = isActive && left > 0n && left < BigInt(7 * 86400)
  const stateLabel = LOAN_STATE_LABELS[loan.data.state] ?? 'unknown'

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        #{loan.data.loanId.toString()}
      </TableCell>
      <TableCell className="font-mono text-xs">
        <AppExplorerLink address={loan.data.borrower} label={shortAddr(loan.data.borrower)} />
      </TableCell>
      <TableCell className="font-mono text-xs text-accent">
        <AppExplorerLink address={loan.data.programPubkey} label={shortAddr(loan.data.programPubkey)} />
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
                isRecovered
                  ? 'bg-destructive'
                  : isRepaid
                    ? 'bg-muted-foreground'
                    : isWarn
                      ? 'bg-warn'
                      : 'bg-accent'
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {isRepaid ? '✓ repaid' : isRecovered ? 'recovered' : formatDuration(left)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isActive
                ? 'bg-accent animate-pulse'
                : isRepaid
                  ? 'bg-muted-foreground'
                  : isRecovered
                    ? 'bg-destructive'
                    : 'bg-warn'
            }`}
          />
          {stateLabel}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <AppExplorerLink
          address={loan.address}
          label="view"
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        />
      </TableCell>
    </TableRow>
  )
}

function Leaderboard({ loans }: { loans: LoanAccount[] }) {
  const ranked = useMemo(() => {
    const byBorrower = new Map<string, { count: number; volume: bigint }>()
    for (const l of loans) {
      const b = l.data.borrower
      const cur = byBorrower.get(b) ?? { count: 0, volume: 0n }
      cur.count += 1
      cur.volume += l.data.principal
      byBorrower.set(b, cur)
    }
    return [...byBorrower.entries()]
      .sort(([, a], [, b]) => Number(b.volume - a.volume))
      .slice(0, 7)
  }, [loans])

  const maxVolume = ranked[0]?.[1].volume ?? 0n

  return (
    <Card className="p-5">
      <CardContent className="space-y-3 p-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          top borrowers
        </div>
        {ranked.length === 0 ? (
          <div className="text-sm text-muted-foreground">no borrowers yet</div>
        ) : (
          <div className="space-y-2">
            {ranked.map(([borrower, stats], i) => {
              const pct = maxVolume > 0n ? Number(stats.volume) / Number(maxVolume) : 0
              return (
                <div key={borrower} className="flex items-center gap-2 font-mono text-xs">
                  <span className="w-4 text-muted-foreground">{i + 1}</span>
                  <span className="w-16 text-accent">
                    <AppExplorerLink address={borrower} label={shortAddr(borrower)} />
                  </span>
                  <div className="h-1 flex-1 rounded bg-secondary">
                    <div className="h-full rounded bg-accent" style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums">
                    {formatSOL(stats.volume, 1)} SOL
                  </span>
                  <span className="w-10 text-right text-muted-foreground tabular-nums">
                    {stats.count} ln
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Skeletons() {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_360px]">
      <Card className="p-5">
        <div className="h-72 animate-pulse rounded bg-muted" />
      </Card>
      <Card className="p-5">
        <div className="h-72 animate-pulse rounded bg-muted" />
      </Card>
    </div>
  )
}

function countByState(loans: LoanAccount[]) {
  const counts = { active: 0, repaid: 0, recovered: 0, other: 0 }
  for (const l of loans) {
    if (l.data.state === LoanState.Active) counts.active += 1
    else if (
      l.data.state === LoanState.Repaid ||
      l.data.state === LoanState.RepaidPendingTransfer
    )
      counts.repaid += 1
    else if (l.data.state === LoanState.Recovered) counts.recovered += 1
    else counts.other += 1
  }
  return counts
}

function computeDefaultRate(loans: LoanAccount[]): number | null {
  const cutoff = BigInt(Math.floor(Date.now() / 1000)) - NINETY_DAYS_SEC
  const recent = loans.filter((l) => l.data.startTs > cutoff)
  if (recent.length === 0) return null
  const recovered = recent.filter((l) => l.data.state === LoanState.Recovered).length
  return (recovered / recent.length) * 100
}
