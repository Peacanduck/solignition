// Minimal loan type for the landing page.
//
// We deliberately do NOT import from `@project/anchor` (the dApp's codama
// client) because that drags in `@solana/kit` and the entire generated
// instruction tree, which is fragile to typecheck cross-package on Vercel
// where `landing/node_modules/` is not on the resolution path from
// `../clients/js/src/`. Landing reads on-chain accounts via Anchor's
// `program.account.X.all()` which decodes from the IDL — codama types are
// not needed at runtime, only the shape we care about.

/** Shape returned by `normalizeLoanData()` — just the fields the landing reads. */
export type NormalizedLoan = {
  loanId: bigint
  borrower: string
  programPubkey: string
  authorityPda: string
  principal: bigint
  duration: bigint
  adminFeePaid: bigint
  startTs: bigint
  /** numeric LoanState: 0=active, 1=repaid, 2=recovered, 3=pending, 4=repaidPendingTransfer, 5=reclaimed */
  state: number
  repaidTs: { value: bigint } | null
  recoveredTs: bigint
  interestPaid: bigint
  reclaimedAmount: bigint
  reclaimedTs: bigint
}
