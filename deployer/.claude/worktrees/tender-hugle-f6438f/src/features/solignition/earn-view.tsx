import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { address } from '@solana/kit'
import { LoanState } from '@project/anchor'
import { useSolana } from '@/components/solana/use-solana'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApyLine } from '@/components/charts/apy-line'
import { PoolDonut, type DonutSegment } from '@/components/charts/pool-donut'
import { AppExplorerLink } from '@/components/app-explorer-link'
import { useDepositMutation } from './data-access/use-deposit-mutation'
import { useWithdrawMutation } from './data-access/use-withdraw-mutation'
import { useDepositorRecord } from './data-access/use-depositor-record'
import { useProtocolConfig } from './data-access/use-protocol-config'
import { useVaultBalance } from './data-access/use-vault-balance'
import { useLoans, type LoanAccount } from './data-access/use-loans'
import { useAllDepositors, type DepositorAccount } from './data-access/use-all-depositors'
import { calculateOwed, formatSOL, shortAddr } from './lib/format'

const SHARE_DECIMALS = 1_000_000_000n
const GAS_BUFFER_SOL = 0.01

export default function EarnView() {
  const { account, client } = useSolana()
  const accountAddress = account?.address

  const depositorQuery = useDepositorRecord(accountAddress ? address(accountAddress) : undefined)
  const configQuery = useProtocolConfig()
  const vaultQuery = useVaultBalance()
  const loansQuery = useLoans()
  const depositorsQuery = useAllDepositors()

  const balanceQuery = useQuery({
    queryKey: ['wallet-balance', accountAddress],
    queryFn: async () => {
      if (!accountAddress) return 0n
      const res: any = await client.rpc.getBalance(address(accountAddress)).send()
      const v = res?.value ?? res
      return typeof v === 'bigint' ? v : BigInt(v ?? 0)
    },
    enabled: !!accountAddress,
    refetchInterval: 15000,
  })

  const vaultLamports = vaultQuery.data ?? 0n
  const totalShares = configQuery.data?.data.totalShares ?? 0n
  const totalLoansOutstanding = configQuery.data?.data.totalLoansOutstanding ?? 0n
  const tvl = vaultLamports + totalLoansOutstanding

  const sharePriceLamports = useMemo(() => {
    if (totalShares === 0n) return SHARE_DECIMALS
    return (tvl * SHARE_DECIMALS) / totalShares
  }, [tvl, totalShares])
  const sharePriceSol = Number(sharePriceLamports) / 1e9

  const accruedInterest = useMemo(
    () => sumAccruedInterest(loansQuery.data ?? []),
    [loansQuery.data],
  )

  const utilization = tvl > 0n ? Number(totalLoansOutstanding) / Number(tvl) : 0
  const defaultRateBps = configQuery.data?.data.defaultInterestRateBps ?? 0
  // TODO: needs annualized rate for true APY — same caveat as dashboard/explore
  const apyPct = (defaultRateBps / 100) * utilization

  return (
    <div className="space-y-8">
      <EarnHeader />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[380px_1fr]">
        <DepositCard
          account={account}
          walletBalance={balanceQuery.data ?? 0n}
          shareAmount={depositorQuery.data?.data.shareAmount ?? 0n}
          sharePriceLamports={sharePriceLamports}
          sharePriceSol={sharePriceSol}
          apyPct={apyPct}
          vaultLamports={vaultLamports}
        />

        <div className="space-y-3.5">
          <ApyCard apyPct={apyPct} />
          <PoolCompositionCard
            available={vaultLamports}
            activeLoans={totalLoansOutstanding}
            accrued={accruedInterest}
            reserve={0n}
            tvl={tvl}
          />
        </div>

        <div className="lg:col-span-2">
          <LpLeaderboard
            depositors={depositorsQuery.data ?? []}
            totalShares={totalShares}
            sharePriceLamports={sharePriceLamports}
            apyPct={apyPct}
            currentAddress={accountAddress}
            loading={depositorsQuery.isLoading}
            error={depositorsQuery.isError}
          />
        </div>
      </div>
    </div>
  )
}

function EarnHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          liquidity provider
        </div>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-tight">
          earn yield on idle <span className="text-accent">SOL</span>.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposit any amount. Earn from loan interest. Withdraw anytime.
        </p>
      </div>
    </div>
  )
}

type DepositCardProps = {
  account: ReturnType<typeof useSolana>['account']
  walletBalance: bigint
  shareAmount: bigint
  sharePriceLamports: bigint
  sharePriceSol: number
  apyPct: number
  vaultLamports: bigint
}

function DepositCard({
  account,
  walletBalance,
  shareAmount,
  sharePriceLamports,
  sharePriceSol,
  apyPct,
  vaultLamports,
}: DepositCardProps) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  return (
    <Card className="p-5 lg:row-span-2">
      <CardContent className="space-y-5 p-0">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            {tab}
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'deposit' | 'withdraw')}>
            <TabsList className="h-8 bg-secondary">
              <TabsTrigger value="deposit" className="px-3 font-mono text-xs">
                deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="px-3 font-mono text-xs">
                withdraw
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'deposit' | 'withdraw')}>
          <TabsContent value="deposit" className="mt-0">
            <DepositForm
              account={account}
              walletBalance={walletBalance}
              sharePriceLamports={sharePriceLamports}
              sharePriceSol={sharePriceSol}
              apyPct={apyPct}
            />
          </TabsContent>
          <TabsContent value="withdraw" className="mt-0">
            <WithdrawForm
              account={account}
              shareAmount={shareAmount}
              sharePriceLamports={sharePriceLamports}
              sharePriceSol={sharePriceSol}
              vaultLamports={vaultLamports}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function DepositForm(props: {
  account: ReturnType<typeof useSolana>['account']
  walletBalance: bigint
  sharePriceLamports: bigint
  sharePriceSol: number
  apyPct: number
}) {
  if (!props.account) {
    return <DepositFormBody {...props} account={null} deposit={null} />
  }
  return <ConnectedDepositForm {...props} account={props.account} />
}

function ConnectedDepositForm(
  props: Omit<Parameters<typeof DepositFormBody>[0], 'deposit'> & {
    account: NonNullable<ReturnType<typeof useSolana>['account']>
  },
) {
  const deposit = useDepositMutation({ account: props.account })
  return <DepositFormBody {...props} deposit={deposit} />
}

function DepositFormBody({
  account,
  walletBalance,
  sharePriceLamports,
  sharePriceSol,
  apyPct,
  deposit,
}: {
  account: ReturnType<typeof useSolana>['account'] | null
  walletBalance: bigint
  sharePriceLamports: bigint
  sharePriceSol: number
  apyPct: number
  deposit: ReturnType<typeof useDepositMutation> | null
}) {
  const [amount, setAmount] = useState('')
  const [showAdv, setShowAdv] = useState(false)

  const balanceSol = Number(walletBalance) / 1e9
  const maxSol = Math.max(0, balanceSol - GAS_BUFFER_SOL)
  const principal = parseFloat(amount) || 0
  const lamports = principal > 0 ? BigInt(Math.floor(principal * 1e9)) : 0n
  const sharesOut =
    sharePriceLamports > 0n ? (lamports * SHARE_DECIMALS) / sharePriceLamports : 0n
  const earned30 = principal * (apyPct / 100) * (30 / 365)
  const earned365 = principal * (apyPct / 100)

  const insufficient = !!account && principal > 0 && lamports > walletBalance
  const isPending = deposit?.isPending ?? false
  const invalid = !account || !deposit || principal <= 0 || insufficient || isPending

  const setQuick = (v: 'max' | number) => {
    if (v === 'max') setAmount(maxSol.toFixed(4))
    else setAmount(String(v))
  }

  const handleSubmit = async () => {
    if (!account || !deposit || lamports <= 0n) return
    await deposit.mutateAsync(lamports)
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          amount
        </label>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="border-0 bg-transparent p-0 font-mono text-2xl shadow-none focus-visible:ring-0"
          />
          <span className="font-mono text-xs text-muted-foreground">SOL</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 font-mono text-[10px]"
            disabled={!account}
            onClick={() => setQuick('max')}
          >
            MAX
          </Button>
        </div>
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>balance: {account ? balanceSol.toFixed(3) : '—'} SOL</span>
          <div className="flex gap-1">
            {[10, 25, 50, 'max'].map((v) => (
              <button
                key={String(v)}
                disabled={!account}
                onClick={() => setQuick(v as 'max' | number)}
                className="rounded border px-2 py-0.5 hover:bg-secondary disabled:opacity-50"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 rounded-md bg-secondary/50 px-3 py-2">
        <ReceiveRow label="you receive" value={`${formatBigShares(sharesOut)} shares`} />
        <ReceiveRow label="share price" value={`${sharePriceSol.toFixed(4)} SOL/share`} />
        <ReceiveRow
          label="est. earn · 30d"
          value={`+${earned30.toFixed(4)} SOL`}
          accent
        />
        <ReceiveRow
          label="est. earn · 1y"
          value={`+${earned365.toFixed(4)} SOL`}
          accent
        />
      </div>

      {insufficient ? (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="font-mono text-xs">
            insufficient balance · max {balanceSol.toFixed(3)} SOL
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="w-full"
        size="lg"
        disabled={invalid}
        onClick={handleSubmit}
        title={!account ? 'connect to deposit' : undefined}
      >
        {!account
          ? 'connect to deposit'
          : isPending
            ? 'depositing…'
            : `deposit ${principal > 0 ? principal.toFixed(2) : ''} SOL →`}
      </Button>

      <button
        className="w-full font-mono text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setShowAdv((s) => !s)}
      >
        {showAdv ? '−' : '+'} advanced options
      </button>
      {showAdv ? (
        <div className="space-y-1.5 rounded-md border border-dashed border-border px-3 py-2">
          {/* TODO: cosmetic stubs — wire when slippage/auto-compound is implemented */}
          <ReceiveRow label="slippage tolerance" value="0.5%" />
          <ReceiveRow label="max gas" value="0.001 SOL" />
          <ReceiveRow label="auto-compound" value="✓ on" accent />
        </div>
      ) : null}

      <div className="font-mono text-[10px] text-muted-foreground">
        ⚠ Yield comes from loan interest and origination fees.
      </div>
    </div>
  )
}

function WithdrawForm(props: {
  account: ReturnType<typeof useSolana>['account']
  shareAmount: bigint
  sharePriceLamports: bigint
  sharePriceSol: number
  vaultLamports: bigint
}) {
  if (!props.account) {
    return <WithdrawFormBody {...props} account={null} withdraw={null} />
  }
  return <ConnectedWithdrawForm {...props} account={props.account} />
}

function ConnectedWithdrawForm(
  props: Omit<Parameters<typeof WithdrawFormBody>[0], 'withdraw'> & {
    account: NonNullable<ReturnType<typeof useSolana>['account']>
  },
) {
  const withdraw = useWithdrawMutation({ account: props.account })
  return <WithdrawFormBody {...props} withdraw={withdraw} />
}

function WithdrawFormBody({
  account,
  shareAmount,
  sharePriceLamports,
  sharePriceSol,
  vaultLamports,
  withdraw,
}: {
  account: ReturnType<typeof useSolana>['account'] | null
  shareAmount: bigint
  sharePriceLamports: bigint
  sharePriceSol: number
  vaultLamports: bigint
  withdraw: ReturnType<typeof useWithdrawMutation> | null
}) {
  const [amount, setAmount] = useState('')

  const positionLamports = (shareAmount * sharePriceLamports) / SHARE_DECIMALS
  const positionSol = Number(positionLamports) / 1e9
  const principal = parseFloat(amount) || 0
  const lamportsOut = principal > 0 ? BigInt(Math.floor(principal * 1e9)) : 0n
  const sharesToBurn =
    sharePriceLamports > 0n ? (lamportsOut * SHARE_DECIMALS) / sharePriceLamports : 0n

  const exceedsPosition = !!account && lamportsOut > positionLamports
  const exceedsLiquidity = !!account && lamportsOut > vaultLamports
  const isPending = withdraw?.isPending ?? false
  const invalid =
    !account ||
    !withdraw ||
    principal <= 0 ||
    exceedsPosition ||
    exceedsLiquidity ||
    isPending

  const handleSubmit = async () => {
    if (!account || !withdraw || sharesToBurn <= 0n) return
    await withdraw.mutateAsync(sharesToBurn)
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          amount
        </label>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            className="border-0 bg-transparent p-0 font-mono text-2xl shadow-none focus-visible:ring-0"
          />
          <span className="font-mono text-xs text-muted-foreground">SOL</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 font-mono text-[10px]"
            disabled={!account || positionSol <= 0}
            onClick={() => setAmount(positionSol.toFixed(4))}
          >
            MAX
          </Button>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          your position: {positionSol.toFixed(4)} SOL · vault liquid:{' '}
          {formatSOL(vaultLamports, 1)} SOL
        </div>
      </div>

      <div className="space-y-1.5 rounded-md bg-secondary/50 px-3 py-2">
        <ReceiveRow label="shares to burn" value={formatBigShares(sharesToBurn)} />
        <ReceiveRow label="share price" value={`${sharePriceSol.toFixed(4)} SOL/share`} />
      </div>

      {exceedsPosition || exceedsLiquidity ? (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="font-mono text-xs">
            {exceedsPosition
              ? `exceeds your position · max ${positionSol.toFixed(4)} SOL`
              : `not enough vault liquidity · max ${formatSOL(vaultLamports, 4)} SOL available`}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="w-full"
        size="lg"
        disabled={invalid}
        onClick={handleSubmit}
        title={!account ? 'connect to withdraw' : undefined}
      >
        {!account
          ? 'connect to withdraw'
          : isPending
            ? 'withdrawing…'
            : `withdraw ${principal > 0 ? principal.toFixed(2) : ''} SOL →`}
      </Button>
    </div>
  )
}

function ReceiveRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between font-mono text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</span>
    </div>
  )
}

function ApyCard({ apyPct }: { apyPct: number }) {
  // TODO: real 30d APY history once snapshot job exists. Flat-line current avg for v1.
  const data = useMemo(() => Array(30).fill(apyPct), [apyPct])
  const min = Math.min(...data)
  const max = Math.max(...data)
  const avg = data.reduce((s, v) => s + v, 0) / data.length
  const sigma = Math.sqrt(
    data.reduce((s, v) => s + (v - avg) ** 2, 0) / data.length,
  )

  return (
    <Card className="p-5">
      <CardContent className="space-y-3 p-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              apy history
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-accent">
              {avg.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">% · 30d avg</span>
            </div>
          </div>
          <div className="flex gap-1 font-mono text-[10px]">
            {/* TODO: timeframe switching needs historical data */}
            {['7d', '30d', '90d', '1y'].map((t) => (
              <span
                key={t}
                className={`rounded border px-2 py-0.5 ${
                  t === '30d' ? 'border-accent text-accent' : 'text-muted-foreground'
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <ApyLine data={data} />
        <div className="grid grid-cols-4 gap-2 font-mono text-xs">
          <Stat k="min" v={`${min.toFixed(2)}%`} />
          <Stat k="avg" v={`${avg.toFixed(2)}%`} accent />
          <Stat k="max" v={`${max.toFixed(2)}%`} />
          <Stat k="σ" v={`${sigma.toFixed(2)}%`} />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">{k}</span>
      <span className={`tabular-nums ${accent ? 'text-accent' : ''}`}>{v}</span>
    </div>
  )
}

function PoolCompositionCard({
  available,
  activeLoans,
  accrued,
  reserve,
  tvl,
}: {
  available: bigint
  activeLoans: bigint
  accrued: bigint
  reserve: bigint
  tvl: bigint
}) {
  const total = Number(tvl) || 1
  const segments: DonutSegment[] = [
    { value: Number(available), color: 'oklch(0.78 0.17 150)', label: 'available · idle' },
    { value: Number(activeLoans), color: 'oklch(0.55 0.12 150)', label: 'active loans' },
    { value: Number(accrued), color: 'oklch(0.78 0.16 75)', label: 'accrued interest' },
    { value: Number(reserve), color: 'oklch(0.5 0.05 150)', label: 'protocol reserve' },
  ]
  const tvlSol = Number(tvl) / 1e9

  return (
    <Card className="p-5">
      <CardContent className="space-y-4 p-0">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            pool composition
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            where the SOL is right now
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="relative">
            <PoolDonut segments={segments} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                total
              </div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                {tvlSol.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">SOL</div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {segments.map((s) => {
            const pct = (s.value / total) * 100
            return (
              <div key={s.label} className="flex items-center gap-2 font-mono text-xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1">{s.label}</span>
                <span className="tabular-nums">{formatSOL(BigInt(Math.round(s.value)), 0)} SOL</span>
                <span className="w-12 text-right text-muted-foreground tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function LpLeaderboard({
  depositors,
  totalShares,
  sharePriceLamports,
  apyPct,
  currentAddress,
  loading,
  error,
}: {
  depositors: DepositorAccount[]
  totalShares: bigint
  sharePriceLamports: bigint
  apyPct: number
  currentAddress?: string
  loading: boolean
  error: boolean
}) {
  const ranked = useMemo(() => {
    return [...depositors].sort((a, b) =>
      Number(b.data.depositedAmount - a.data.depositedAmount),
    )
  }, [depositors])

  const top = ranked.slice(0, 7)
  const myIndex = currentAddress
    ? ranked.findIndex((d) => d.data.owner === currentAddress)
    : -1
  const meInTop = myIndex >= 0 && myIndex < 7
  const showSelfRow = myIndex >= 7

  return (
    <Card className="p-5">
      <CardContent className="space-y-3 p-0">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              top lps
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              by deposit · {ranked.length} LPs total
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground">couldn't load leaderboard</div>
        ) : ranked.length === 0 ? (
          <div className="text-sm text-muted-foreground">no LPs yet</div>
        ) : (
          <div className="space-y-1.5">
            {top.map((d, i) => (
              <LpRow
                key={d.data.owner}
                rank={i + 1}
                depositor={d}
                totalShares={totalShares}
                sharePriceLamports={sharePriceLamports}
                apyPct={apyPct}
                isMe={meInTop && i === myIndex}
              />
            ))}
            {showSelfRow ? (
              <>
                <div className="my-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  ── you ──
                </div>
                <LpRow
                  rank={myIndex + 1}
                  depositor={ranked[myIndex]}
                  totalShares={totalShares}
                  sharePriceLamports={sharePriceLamports}
                  apyPct={apyPct}
                  isMe
                />
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LpRow({
  rank,
  depositor,
  totalShares,
  sharePriceLamports,
  apyPct,
  isMe,
}: {
  rank: number
  depositor: DepositorAccount
  totalShares: bigint
  sharePriceLamports: bigint
  apyPct: number
  isMe?: boolean
}) {
  const sharePct =
    totalShares > 0n ? (Number(depositor.data.shareAmount) / Number(totalShares)) * 100 : 0
  const valueLamports =
    (depositor.data.shareAmount * sharePriceLamports) / SHARE_DECIMALS
  const earnedLamports =
    valueLamports > depositor.data.depositedAmount
      ? valueLamports - depositor.data.depositedAmount
      : 0n

  return (
    <div
      className={`flex items-center gap-2 rounded-md font-mono text-xs ${
        isMe ? 'border border-accent/40 bg-accent/5 px-2 py-1' : 'px-2 py-1'
      }`}
    >
      <span className="w-5 text-[10px] text-muted-foreground">{isMe ? '»' : rank}</span>
      <span className="w-24 text-accent">
        <AppExplorerLink address={depositor.data.owner} label={shortAddr(depositor.data.owner)} />
      </span>
      <span className="w-24 text-right tabular-nums">
        {formatSOL(depositor.data.depositedAmount, 2)}
      </span>
      <span className="w-12 text-right text-[10px] text-muted-foreground tabular-nums">
        {sharePct.toFixed(2)}%
      </span>
      <span className="w-16 text-right text-muted-foreground tabular-nums">
        {apyPct.toFixed(2)}%
      </span>
      <span className="ml-auto w-20 text-right text-accent tabular-nums">
        +{formatSOL(earnedLamports, 3)}
      </span>
    </div>
  )
}

function sumAccruedInterest(loans: LoanAccount[]): bigint {
  let total = 0n
  for (const l of loans) {
    if (l.data.state !== LoanState.Active) continue
    const owed = calculateOwed(l)
    if (owed > l.data.principal) total += owed - l.data.principal
  }
  return total
}

function formatBigShares(shares: bigint): string {
  if (shares === 0n) return '0'
  const num = Number(shares)
  if (Number.isFinite(num) && num < 1e15) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  return shares.toString()
}
