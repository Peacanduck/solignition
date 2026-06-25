import { useEffect } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppExplorerLink } from '@/components/app-explorer-link'
import {
  computeInterest,
  sumPrincipal,
  type DeploymentEvent,
  type WizardAction,
  type WizardState,
} from './use-borrow-wizard'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useProject, type ProgramLoanStatus } from '../data-access/use-project'
import { formatSOL } from '../lib/format'
import { useFetchSigned } from '@/lib/fetch-signed'
import { StepHead } from './step-upload'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

interface LoanStatusResponse {
  loanId: string
  status: ProgramLoanStatus
  deployment: { programId?: string; updatedAt?: number } | null
  updatedAt: number | null
}

const STUB_TIMELINE: DeploymentEvent[] = [
  { title: 'loan created', tx: null, status: 'confirmed' },
  { title: 'pool disbursed', tx: null, status: 'confirmed' },
  { title: 'deployer picked up request', tx: null, status: 'observed' },
  { title: 'program account allocated', tx: null, status: 'pending' },
  { title: 'bytecode written', tx: null, status: 'pending' },
  { title: 'program deployed', tx: null, status: 'pending' },
]

export function StepStatus({
  state,
  dispatch,
  account,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  account: UiWalletAccount
}) {
  const isProject = state.programs.length > 1
  const configQuery = useProtocolConfig()
  const adminFeeBps = configQuery.data?.data.defaultAdminFeeBps ?? 0
  const principal = sumPrincipal(state.programs, adminFeeBps)
  const interest = computeInterest(principal, state.interestRateBps, state.duration)
  const totalOwed = principal + interest
  const repayBy = new Date(Date.now() + state.duration * 86400000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  if (isProject) {
    return (
      <ProjectStatus
        projectId={state.projectId}
        projectName={state.projectName}
        repayBy={repayBy}
        totalOwed={totalOwed}
      />
    )
  }

  return (
    <SingleLoanStatus state={state} dispatch={dispatch} account={account} repayBy={repayBy} totalOwed={totalOwed} />
  )
}

// ── Project (N programs, one signature) ────────────────────────────────────
function ProjectStatus({
  projectId,
  projectName,
  repayBy,
  totalOwed,
}: {
  projectId: string
  projectName: string
  repayBy: string
  totalOwed: bigint
}) {
  const projectQuery = useProject({ projectId })
  const data = projectQuery.data
  const aggregate = data?.status ?? 'pending'
  const done = aggregate === 'deployed' || aggregate === 'failed'
  const programs = data?.programs ?? []

  return (
    <div className="grid grid-cols-1 gap-3.5">
      <Card className="p-6">
        <CardContent className="space-y-6 p-0">
          <StepHead
            n="05 · live"
            title={
              aggregate === 'deployed'
                ? '✓ all deployed.'
                : aggregate === 'failed'
                  ? '× deployment failed'
                  : aggregate === 'partial'
                    ? 'partially deployed'
                    : 'deploying…'
            }
          >
            {projectName ? `${projectName} · ` : ''}
            {done
              ? 'Authority held by the protocol until you repay the project.'
              : `Watch the deployer ship ${programs.length || 'your'} programs in real time.`}
          </StepHead>

          <div className="flex items-center gap-2">
            <ProjectBadge status={aggregate} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {programs.filter((p) => p.status === 'deployed').length}/{programs.length} deployed
            </span>
          </div>

          <div className="space-y-2">
            {programs.length === 0 ? (
              <div className="font-mono text-xs text-muted-foreground">
                waiting for the deployer to pick up the project…
              </div>
            ) : (
              programs.map((p) => <ProgramStatusRow key={p.loanId} program={p} />)
            )}
          </div>

          {done ? (
            <div className="space-y-2 rounded-md border border-accent/40 bg-accent/5 p-4">
              <SuccessRow k="programs" v={`${programs.length}`} />
              <SuccessRow k="authority" v="protocol (escrow)" />
              <SuccessRow k="repay by" v={repayBy} />
              <SuccessRow k="total owed" v={`${formatSOL(totalOwed, 4)} SOL`} accent bold />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            {done ? (
              <Button asChild>
                <Link to="/solignition/dashboard">go to dashboard →</Link>
              </Button>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">deployment in progress…</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProgramStatusRow({
  program,
}: {
  program: {
    loanId: string
    index: number
    name?: string
    status: ProgramLoanStatus
    deployment: { programId?: string } | null
  }
}) {
  const label = program.name || `program ${program.index + 1}`
  const programId = program.deployment?.programId
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <ProgramStatusIcon status={program.status} />
        <span className="font-mono text-sm">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">loan #{program.loanId}</span>
      </div>
      <div className="flex items-center gap-3">
        {programId && programId !== '11111111111111111111111111111111' ? (
          <AppExplorerLink
            address={programId}
            label={`${programId.slice(0, 6)}…`}
            className="font-mono text-xs text-accent"
          />
        ) : null}
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {program.status}
        </span>
      </div>
    </div>
  )
}

function ProgramStatusIcon({ status }: { status: ProgramLoanStatus }) {
  if (status === 'deployed' || status === 'repaid') return <span className="text-accent">✓</span>
  if (status === 'failed' || status === 'expired') return <span className="text-destructive">×</span>
  if (status === 'deploying' || status === 'uploading') return <span className="text-accent animate-pulse">◌</span>
  return <span className="text-muted-foreground">○</span>
}

function ProjectBadge({ status }: { status: 'pending' | 'deploying' | 'partial' | 'deployed' | 'failed' }) {
  const styles: Record<typeof status, string> = {
    pending: 'border-border text-muted-foreground',
    deploying: 'border-accent/50 text-accent',
    partial: 'border-warn/50 text-warn',
    deployed: 'border-accent/50 bg-accent/10 text-accent',
    failed: 'border-destructive/50 text-destructive',
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${styles[status]}`}
    >
      {status}
    </span>
  )
}

// ── Single program (unchanged behavior; reads loanIds[0]) ──────────────────
function SingleLoanStatus({
  state,
  dispatch,
  account,
  repayBy,
  totalOwed,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  account: UiWalletAccount
  repayBy: string
  totalOwed: bigint
}) {
  const fetchSigned = useFetchSigned(account)
  const loanId = state.loanIds[0] ?? null
  const done = !!state.programId

  // TODO: switch to SSE/WebSocket once deployer exposes one
  const statusQuery = useQuery<LoanStatusResponse | null>({
    queryKey: ['deployment-status', loanId?.toString()],
    queryFn: async () => {
      if (!loanId) return null
      try {
        const res = await fetchSigned(`${DEPLOYER_API_URL}/v1/loans/${loanId.toString()}/status`)
        if (!res.ok) return null
        return (await res.json()) as LoanStatusResponse
      } catch {
        return null
      }
    },
    refetchInterval: 2000,
    enabled: !!loanId && !done,
  })

  // Fall back to stubbed timer when the endpoint hasn't progressed past 'pending'
  useEffect(() => {
    if (done) return
    if (statusQuery.data && statusQuery.data.status !== 'pending') return
    if (state.deploymentEvents.length === 0) {
      dispatch({ type: 'EVENTS_UPDATED', events: [{ ...STUB_TIMELINE[0], status: 'observed' }] })
      return
    }
    const next = state.deploymentEvents.length
    if (next >= STUB_TIMELINE.length) return
    const id = window.setTimeout(() => {
      const isFinal = next + 1 === STUB_TIMELINE.length
      const promoted: DeploymentEvent[] = STUB_TIMELINE.slice(0, next + 1).map((e, i) => ({
        ...e,
        status: i < next || isFinal ? 'confirmed' : 'observed',
      }))
      dispatch({ type: 'EVENTS_UPDATED', events: promoted })
      if (isFinal) {
        dispatch({ type: 'PROGRAM_DEPLOYED', programId: 'pending-program-id' })
      }
    }, 1500)
    return () => window.clearTimeout(id)
  }, [state.deploymentEvents.length, statusQuery.data, done, dispatch])

  // When the v1 status endpoint reports a deployed programId, mirror it into state.
  useEffect(() => {
    const pid = statusQuery.data?.deployment?.programId
    if (pid && !state.programId) {
      dispatch({ type: 'PROGRAM_DEPLOYED', programId: pid })
    }
  }, [statusQuery.data, state.programId, dispatch])

  const events = state.deploymentEvents.length ? state.deploymentEvents : STUB_TIMELINE

  return (
    <div className="grid grid-cols-1 gap-3.5">
      <Card className="p-6">
        <CardContent className="space-y-6 p-0">
          <StepHead n="05 · live" title={done ? '✓ deployed.' : 'deploying…'}>
            {done ? (
              <>Your program is live. Authority held by protocol until you repay.</>
            ) : (
              <>Watch the deployer ship your program in real time.</>
            )}
          </StepHead>

          <Timeline events={events} />

          {done ? (
            <div className="space-y-2 rounded-md border border-accent/40 bg-accent/5 p-4">
              <SuccessRow k="program id" v={state.programId ?? '—'} accent mono />
              <SuccessRow k="authority" v="protocol (escrow)" />
              <SuccessRow k="repay by" v={repayBy} />
              <SuccessRow k="total owed" v={`${formatSOL(totalOwed, 4)} SOL`} accent bold />
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            {done ? (
              <>
                {state.signature ? (
                  <Button variant="ghost" asChild>
                    <AppExplorerLink transaction={state.signature} label="view tx ↗" className="font-mono text-xs" />
                  </Button>
                ) : null}
                <Button asChild>
                  <Link to="/solignition/dashboard">go to dashboard →</Link>
                </Button>
              </>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">deployment in progress…</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Timeline({ events }: { events: DeploymentEvent[] }) {
  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="mt-0.5 w-4 text-center font-mono text-xs">
            {e.status === 'confirmed' ? (
              <span className="text-accent">✓</span>
            ) : e.status === 'observed' ? (
              <span className="text-accent animate-pulse">◌</span>
            ) : e.status === 'failed' ? (
              <span className="text-destructive">×</span>
            ) : (
              <span className="text-muted-foreground">○</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-mono text-sm">{e.title}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {e.tx ? `tx ${e.tx.slice(0, 6)}…${e.tx.slice(-4)} · ` : ''}
              {e.status}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SuccessRow({
  k,
  v,
  accent,
  bold,
  mono,
}: {
  k: string
  v: string
  accent?: boolean
  bold?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={`${accent ? 'text-accent' : ''} ${bold ? 'font-semibold' : ''} ${mono ? 'truncate' : ''} tabular-nums`}
      >
        {v}
      </span>
    </div>
  )
}
