// Loan normalization helpers — copy of the private utilities in
// `src/features/solignition/data-access/use-loans.ts` (lines 188–241).
// Anchor's `program.account.loan.all()` returns BN/PublicKey-shaped fields
// that don't match the codama-typed `Loan` interface; this normalizes the
// shape so the rest of the landing can treat it as `Loan`.

import { BN } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import type { NormalizedLoan } from './loan-types'

export function parseState(state: unknown): number {
  if (typeof state === 'number') return state
  if (state && typeof state === 'object') {
    const s = state as Record<string, unknown>
    if (s.active !== undefined) return 0
    if (s.repaid !== undefined) return 1
    if (s.recovered !== undefined) return 2
    if (s.pending !== undefined) return 3
    if (s.repaidPendingTransfer !== undefined) return 4
    if (s.reclaimed !== undefined) return 5
  }
  return -1
}

export function bnToBigInt(bn: unknown): bigint {
  if (bn === null || bn === undefined) return 0n
  if (typeof bn === 'bigint') return bn
  if (typeof bn === 'number') return BigInt(bn)
  if (typeof bn === 'string') return BigInt(bn)
  if (bn instanceof BN || (typeof bn === 'object' && '_bn' in (bn as object))) {
    return BigInt((bn as { toString: () => string }).toString())
  }
  return 0n
}

export function publicKeyToString(pubkey: unknown): string {
  if (typeof pubkey === 'string') return pubkey
  if (pubkey && typeof pubkey === 'object') {
    if ('toString' in pubkey) return (pubkey as { toString: () => string }).toString()
    if ('_bn' in pubkey) return new PublicKey(pubkey as never).toString()
  }
  return String(pubkey ?? '')
}

export function normalizeLoanData(rawData: Record<string, unknown>): NormalizedLoan {
  const repaidTsRaw = bnToBigInt(rawData.repaidTs)
  return {
    loanId: bnToBigInt(rawData.loanId),
    borrower: publicKeyToString(rawData.borrower),
    programPubkey: publicKeyToString(rawData.programPubkey),
    authorityPda: publicKeyToString(rawData.authorityPda),
    principal: bnToBigInt(rawData.principal),
    duration: bnToBigInt(rawData.duration),
    adminFeePaid: bnToBigInt(rawData.adminFeePaid),
    startTs: bnToBigInt(rawData.startTs),
    state: parseState(rawData.state),
    repaidTs: repaidTsRaw !== 0n ? { value: repaidTsRaw } : null,
    recoveredTs: bnToBigInt(rawData.recoveredTs),
    interestPaid: bnToBigInt(rawData.interestPaid),
    reclaimedAmount: bnToBigInt(rawData.reclaimedAmount),
    reclaimedTs: bnToBigInt(rawData.reclaimedTs),
  }
}
