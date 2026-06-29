import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { formatSOL } from '../lib/format'
import {
  computeInterest,
  DURATION_RATES,
  NETWORK_FEE_LAMPORTS,
  sumPrincipal,
  sumRent,
  type WizardAction,
  type WizardState,
} from './use-borrow-wizard'
import { SidePanel, StepHead } from './step-upload'

export function StepTerms({
  state,
  dispatch,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
}) {
  const configQuery = useProtocolConfig()
  const adminFeeBps = configQuery.data?.data.defaultAdminFeeBps ?? 0
  const programCount = state.programs.length

  // A project carries one loan per program; each loan has its own rent +
  // network fee + protocol fee. These totals sum across all program slots
  // (and reduce to the single-program case when programCount === 1).
  const rent = sumRent(state.programs)
  const network = NETWORK_FEE_LAMPORTS * BigInt(programCount)
  const principal = sumPrincipal(state.programs, adminFeeBps)
  const protocolFee = principal - rent - network
  const interest = computeInterest(principal, state.interestRateBps, state.duration)
  const totalOwed = principal + interest

  const dueDate = new Date(Date.now() + state.duration * 86400000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const ratePctDisplay = (state.interestRateBps / 100).toFixed(1)
  const continueDisabled = principal <= 0n

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <CardContent className="space-y-6 p-0">
          <StepHead n="02 · terms" title="choose your loan terms">
            Longer terms have higher rates. Repay anytime before expiry.
          </StepHead>

          <Field label="duration">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([7, 30, 60, 90] as const).map((d) => {
                const rate = DURATION_RATES[d]
                const active = state.duration === d
                return (
                  <button
                    key={d}
                    onClick={() => dispatch({ type: 'SET_DURATION', duration: d })}
                    className={`flex flex-col items-start gap-0.5 rounded-md border p-3 text-left font-mono transition ${
                      active
                        ? 'border-accent bg-accent/5 text-foreground'
                        : 'border-border hover:bg-secondary/50'
                    }`}
                  >
                    <span className="text-2xl tabular-nums">{d}</span>
                    <span className="text-[10px] text-muted-foreground">days</span>
                    <span className={`mt-1 text-xs ${active ? 'text-accent' : 'text-muted-foreground'}`}>
                      {(rate / 100).toFixed(1)}%
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field
            label={
              programCount > 1
                ? `principal · ${programCount} programs · auto-calculated`
                : 'principal · auto-calculated'
            }
          >
            <div className="space-y-1.5 rounded-md bg-secondary/50 px-3 py-3">
              <ReadoutRow
                label={programCount > 1 ? 'deployment rent (all programs)' : 'deployment rent'}
                value={`${formatSOL(rent, 4)} SOL`}
              />
              <ReadoutRow label="network fees (est)" value={`${formatSOL(network, 4)} SOL`} />
              <ReadoutRow
                label={`protocol fee · ${(adminFeeBps / 100).toFixed(2)}%`}
                value={`${formatSOL(protocolFee, 4)} SOL`}
              />
              <div className="my-1 h-px bg-border" />
              <ReadoutRow
                label="principal"
                value={`${formatSOL(principal, 4)} SOL`}
                accent
                bold
              />
            </div>
          </Field>

          {/* TODO: wire autoRollover once on-chain instruction supports it */}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => dispatch({ type: 'GO', step: 'upload' })}>
              ← back
            </Button>
            <Button
              disabled={continueDisabled}
              onClick={() => dispatch({ type: 'GO', step: 'review' })}
            >
              continue → review
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3.5">
        <Card className="p-5">
          <CardContent className="space-y-2 p-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              you'll owe
            </div>
            <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {formatSOL(totalOwed, 4)}{' '}
              <span className="text-base font-normal text-muted-foreground">SOL</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              due in {state.duration} days · {dueDate}
            </div>
            <div className="mt-2 space-y-1.5 border-t border-border pt-2">
              <ReadoutRow label="principal" value={formatSOL(principal, 4)} />
              <ReadoutRow
                label={`interest · ${ratePctDisplay}% APR`}
                value={`+${formatSOL(interest, 4)}`}
                accent
              />
              <ReadoutRow label="total repay" value={formatSOL(totalOwed, 4)} bold />
            </div>
          </CardContent>
        </Card>
        <SidePanel
          title="ABOUT THE TERMS"
          rows={[
            ['rate', 'fixed at signing'],
            ['penalty', 'none for early repay'],
            ['default', 'protocol recovers .so'],
            ['authority', 'transfers on repay'],
          ]}
        />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadoutRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string
  value: string
  accent?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between font-mono text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${accent ? 'text-accent' : ''} ${bold ? 'font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  )
}
