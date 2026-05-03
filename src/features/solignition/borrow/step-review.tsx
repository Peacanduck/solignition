import { useState } from 'react'
import type { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { formatSOL, shortAddr } from '../lib/format'
import {
  computeInterest,
  computePrincipal,
  type WizardAction,
  type WizardState,
} from './use-borrow-wizard'
import { StepHead } from './step-upload'

export function StepReview({
  state,
  dispatch,
  account,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  account: UiWalletAccount
}) {
  const configQuery = useProtocolConfig()
  const adminFeeBps = configQuery.data?.data.defaultAdminFeeBps ?? 0
  const rent = state.estimatedRent ?? 0n
  const { principal } = computePrincipal(rent, adminFeeBps)
  const interest = computeInterest(principal, state.interestRateBps, state.duration)
  const totalOwed = principal + interest

  const [ackDefault, setAckDefault] = useState(false)
  const [ackRisk, setAckRisk] = useState(false)
  const canSign = ackDefault && ackRisk

  const expires = new Date(Date.now() + state.duration * 86400000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const ratePct = (state.interestRateBps / 100).toFixed(1)

  const summary: [string, string, 'accent' | 'muted' | undefined][] = [
    ['program file', `${state.file?.name ?? '—'} · ${state.file ? (state.file.size / 1024).toFixed(0) : '—'} KB`, undefined],
    ['borrower', `${shortAddr(account.address)} (you)`, undefined],
    ['principal', `${formatSOL(principal, 4)} SOL`, 'accent'],
    ['interest rate', `${ratePct}% APR`, undefined],
    ['duration', `${state.duration} days`, undefined],
    ['expires', expires, undefined],
    ['interest owed', `${formatSOL(interest, 4)} SOL`, undefined],
    ['total repay', `${formatSOL(totalOwed, 4)} SOL`, 'accent'],
    ['authority', 'protocol (escrow)', 'muted'],
    ['authority on repay', `${shortAddr(account.address)} (you)`, 'accent'],
  ]

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <CardContent className="space-y-6 p-0">
          <StepHead n="03 · review" title="review the loan">
            All terms are final once you sign. The protocol will deploy automatically.
          </StepHead>

          <div className="space-y-1.5 rounded-md bg-secondary/50 px-3 py-3">
            {summary.map(([k, v, color]) => (
              <div key={k} className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span
                  className={
                    color === 'accent'
                      ? 'font-semibold text-accent tabular-nums'
                      : color === 'muted'
                        ? 'text-muted-foreground tabular-nums'
                        : 'tabular-nums'
                  }
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-start gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={ackDefault}
                onChange={(e) => setAckDefault(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I understand that if I don't repay by expiry, the protocol will close the program
                and reclaim SOL.
              </span>
            </label>
            <label className="flex items-start gap-2 font-mono text-xs">
              <input
                type="checkbox"
                checked={ackRisk}
                onChange={(e) => setAckRisk(e.target.checked)}
                className="mt-0.5"
              />
              <span>I've read the protocol risk disclosure.</span>
            </label>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => dispatch({ type: 'GO', step: 'terms' })}>
              ← back
            </Button>
            <Button disabled={!canSign} onClick={() => dispatch({ type: 'GO', step: 'sign' })}>
              sign transaction →
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="p-5">
        <CardContent className="space-y-3 p-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            transaction preview
          </div>
          <pre className="overflow-x-auto rounded bg-secondary p-3 font-mono text-[11px] leading-relaxed">
{`Instruction: RequestLoan
Accounts:
  [w] borrower    ${shortAddr(account.address)}
  [w] config      <protocol config PDA>
  [w] loan        <derived loan PDA>
  [r] deployer    <protocol deployer>
  [r] system      111...
Args:
  principal       ${principal.toString()} lamports
  duration        ${BigInt(state.duration * 86400).toString()} seconds
  rate_bps        ${state.interestRateBps}
  admin_fee_bps   ${adminFeeBps}`}
          </pre>
          <div className="font-mono text-[10px] text-muted-foreground">
            ⚠ never sign blind · verify amounts in your wallet
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
