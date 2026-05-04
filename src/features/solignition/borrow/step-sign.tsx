import { useState } from 'react'
import type { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useRequestLoanMutation } from '../data-access/use-request-loan-mutation'
import { useSolana } from '@/components/solana/use-solana'
import { formatSOL } from '../lib/format'
import { computePrincipal, type WizardAction, type WizardState } from './use-borrow-wizard'
import { StepHead } from './step-upload'

type Phase = 'idle' | 'signing' | 'confirmed'

const PHASE_ORDER: Phase[] = ['idle', 'signing', 'confirmed']
const PHASE_LABELS: { k: Phase; l: string }[] = [
  { k: 'idle', l: 'awaiting signature' },
  { k: 'signing', l: 'signing in wallet…' },
  { k: 'confirmed', l: 'confirmed · creating loan' },
]

export function StepSign({
  state,
  dispatch,
  account,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  account: UiWalletAccount
}) {
  const { cluster } = useSolana()
  const configQuery = useProtocolConfig()
  const requestLoan = useRequestLoanMutation({ account })
  const [phase, setPhase] = useState<Phase>('idle')

  const adminFeeBps = configQuery.data?.data.defaultAdminFeeBps ?? 0
  const rent = state.estimatedRent ?? 0n
  const { principal } = computePrincipal(rent, adminFeeBps)
  const ratePct = (state.interestRateBps / 100).toFixed(1)

  const handleSign = async () => {
    if (!state.fileId) {
      dispatch({ type: 'ERROR', error: { code: 'NO_FILE', message: 'No uploaded file id' } })
      return
    }
    if (!configQuery.data) {
      dispatch({ type: 'ERROR', error: { code: 'NO_CONFIG', message: 'Protocol config not loaded' } })
      return
    }
    setPhase('signing')
    const loanId = configQuery.data.data.loanCounter
    try {
      const sig = await requestLoan.mutateAsync({
        principal,
        duration: BigInt(state.duration * 86400), // TEST change for testing expirey 300n 5min
        interestRateBps: state.interestRateBps,
        adminFeeBps,
        fileId: state.fileId,
        useExisting: false,
      })
      setPhase('confirmed')
      dispatch({ type: 'SIGNED', signature: sig as unknown as string, loanId })
      // brief pause so the user sees the ✓ before we transition
      setTimeout(() => dispatch({ type: 'GO', step: 'status' }), 800)
    } catch (e: any) {
      dispatch({
        type: 'ERROR',
        error: { code: e?.code ?? 'SIGN_FAILED', message: e?.message ?? 'Signing failed' },
      })
      setPhase('idle')
    }
  }

  const phaseIndex = PHASE_ORDER.indexOf(phase)

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <CardContent className="space-y-6 p-0">
          <StepHead n="04 · sign" title="sign in your wallet">
            Approve the transaction in your wallet. We'll wait for confirmation.
          </StepHead>

          <div className="flex flex-col items-center gap-6 py-4">
            <SignOrb phase={phase} />
            <div className="space-y-1.5">
              {PHASE_LABELS.map(({ k, l }, i) => {
                const done = i < phaseIndex
                const active = i === phaseIndex && k !== 'idle'
                return (
                  <div
                    key={k}
                    className={`flex items-center gap-2 font-mono text-xs ${
                      done || active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className={done ? 'text-accent' : active ? 'text-accent animate-pulse' : ''}>
                      {done ? '✓' : active ? '◌' : '○'}
                    </span>
                    <span>{l}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: 'GO', step: 'review' })}
              disabled={phase !== 'idle'}
            >
              ← back
            </Button>
            <Button onClick={handleSign} disabled={phase !== 'idle'}>
              {phase === 'idle'
                ? 'open wallet & sign →'
                : phase === 'confirmed'
                  ? '✓ confirmed'
                  : 'waiting…'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="p-5">
        <CardContent className="space-y-3 p-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            sign-off details
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            <Row k="amount" v={`${formatSOL(principal, 4)} SOL`} accent />
            <Row k="to" v="protocol pool" />
            <Row k="rate" v={`${ratePct}% · ${state.duration}d`} />
            <Row k="network" v={cluster?.label ?? '—'} />
          </div>
          <div className="rounded bg-secondary p-2 font-mono text-[10px] text-muted-foreground">
            ⚠ never sign blind · verify amounts in your wallet
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={accent ? 'text-accent tabular-nums' : 'tabular-nums'}>{v}</span>
    </div>
  )
}

function SignOrb({ phase }: { phase: Phase }) {
  const dashOff = phase === 'idle' ? 200 : phase === 'signing' ? 100 : 0
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
      <circle cx="40" cy="40" r="36" className="stroke-border" strokeWidth="1" />
      {phase === 'idle' ? (
        <circle cx="40" cy="40" r="20" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
      ) : (
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          className="stroke-accent"
          strokeWidth="2"
          strokeDasharray="200"
          strokeDashoffset={dashOff}
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 1.4s ease' }}
        />
      )}
      {phase === 'confirmed' ? (
        <path
          d="M28 40 L36 48 L52 32"
          className="stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
    </svg>
  )
}
