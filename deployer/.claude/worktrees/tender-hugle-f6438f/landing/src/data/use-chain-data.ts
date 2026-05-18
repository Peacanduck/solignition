// Single read-only chain-data hook for the landing page.
//
// Replaces six placeholder values with live devnet state in one polling pass.
// We do not use @tanstack/react-query (the dApp does, but the landing has
// only this one query — a plain useState + useEffect with a 30s interval is
// simpler and avoids pulling react-query into the landing bundle).

import { useEffect, useState } from 'react'
import { connection, getVaultPda, getConfigPda, program } from './program'
import { normalizeLoanData } from './normalize'
import type { NormalizedLoan } from './loan-types'

const POLL_INTERVAL_MS = 30_000
const LAMPORTS_PER_SOL = 1_000_000_000n

export type FeedRow = {
  id: number
  borrower: string
  amount: string
  age: string
  progress: number
  timeLeft: string
  state: 'active' | 'repaid' | 'recovered'
}

export type ChainStats = {
  tvlSol: string
  programsDeployed: number
  lpApy: string
  avgLoanSizeSol: string
  /** Distinct depositor count. null until we wire DepositorRecord enumeration. */
  // TODO: count distinct depositorRecord accounts
  lpCount: number | null
}

export type ChainData = {
  stats: ChainStats | null
  feed: FeedRow[] | null
  loading: boolean
  error: string | null
}

function lamportsToSol(lamports: bigint, decimals = 2): string {
  // Avoid Number precision loss on huge values by integer-dividing first.
  const whole = lamports / LAMPORTS_PER_SOL
  const frac = lamports % LAMPORTS_PER_SOL
  const fracStr = (Number(frac) / 1_000_000_000).toFixed(decimals).slice(1) // ".XX"
  return `${whole.toString()}${fracStr}`
}

function shortBorrower(addr: string): string {
  if (addr.length <= 8) return addr
  return `${addr.slice(0, 3)}...${addr.slice(-3)}`
}

function formatRelativeAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86_400)}d`
}

function formatTimeLeft(seconds: number, state: FeedRow['state']): string {
  if (state === 'repaid') return '✓'
  if (state === 'recovered') return '⚠'
  if (seconds <= 0) return '0h'
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || n < 0) return 0
  if (n > 1) return 1
  return n
}

function mapState(state: number): FeedRow['state'] | null {
  if (state === 0 || state === 3) return 'active' // active or pending
  if (state === 1 || state === 4) return 'repaid' // repaid or repaidPendingTransfer
  if (state === 2 || state === 5) return 'recovered' // recovered or reclaimed
  return null
}

function deriveFeed(loans: NormalizedLoan[]): FeedRow[] {
  const now = Math.floor(Date.now() / 1000)
  const enriched = loans
    .map((l) => {
      const state = mapState(l.state)
      if (!state) return null
      const startTs = Number(l.startTs)
      const duration = Number(l.duration)
      const elapsed = now - startTs
      const progress = duration > 0 ? clamp01(elapsed / duration) : 0
      const timeLeft = formatTimeLeft(duration - elapsed, state)
      const row: FeedRow = {
        id: Number(l.loanId),
        borrower: shortBorrower(l.borrower),
        amount: lamportsToSol(l.principal, 2),
        age: formatRelativeAge(elapsed),
        progress,
        timeLeft,
        state,
      }
      return { row, startTs }
    })
    .filter((r): r is { row: FeedRow; startTs: number } => r !== null)

  enriched.sort((a, b) => b.startTs - a.startTs)
  return enriched.slice(0, 6).map((e) => e.row)
}

function deriveStats(
  loans: NormalizedLoan[],
  vaultLamports: bigint,
  totalYieldDistributed: bigint,
): ChainStats {
  const tvlSol = lamportsToSol(vaultLamports, 2)

  // Programs deployed = any loan that successfully shipped (everything past
  // the `pending` state, including repaid / recovered / reclaimed).
  const programsDeployed = loans.filter((l) => l.state !== 3).length

  // APY formula matches the dApp's depositor-stats-display.tsx (lines 45–52):
  // cumulative-since-inception ratio, not annualized. Consistency with the
  // dApp number wins over correctness for the marketing page.
  // TODO: replace with annualized APY once a share-price-history indexer exists.
  const lpApy =
    vaultLamports === 0n
      ? '0.00'
      : ((Number(totalYieldDistributed) / Number(vaultLamports)) * 100).toFixed(2)

  const principalSum = loans.reduce((acc, l) => acc + l.principal, 0n)
  const avgLoanLamports = loans.length === 0 ? 0n : principalSum / BigInt(loans.length)
  const avgLoanSizeSol = lamportsToSol(avgLoanLamports, 2)

  return {
    tvlSol,
    programsDeployed,
    lpApy,
    avgLoanSizeSol,
    lpCount: null,
  }
}

export function useChainData(): ChainData {
  const [data, setData] = useState<ChainData>({
    stats: null,
    feed: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      try {
        const [vaultLamports, configAccount, rawLoans] = await Promise.all([
          connection.getBalance(getVaultPda()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (program.account as any).protocolConfig.fetch(getConfigPda()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (program.account as any).loan.all(),
        ])

        const loans = (rawLoans as Array<{ account: Record<string, unknown> }>).map(
          (a) => normalizeLoanData(a.account),
        )

        const totalYieldDistributed = BigInt(
          (configAccount?.totalYieldDistributed?.toString?.() ?? '0') as string,
        )

        const stats = deriveStats(loans, BigInt(vaultLamports), totalYieldDistributed)
        const feed = deriveFeed(loans)

        if (!cancelled) {
          setData({ stats, feed, loading: false, error: null })
        }
      } catch (err) {
        console.error('useChainData fetch failed:', err)
        if (!cancelled) {
          setData((prev) => ({
            stats: prev.stats,
            feed: prev.feed,
            loading: false,
            error: err instanceof Error ? err.message : 'failed to reach RPC',
          }))
        }
      }
    }

    fetchAll()
    const id = setInterval(fetchAll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return data
}
