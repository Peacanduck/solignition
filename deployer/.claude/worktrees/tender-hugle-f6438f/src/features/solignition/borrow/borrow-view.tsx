import { useSolana } from '@/components/solana/use-solana'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBorrowWizard, STEPS, type WizardStep } from './use-borrow-wizard'
import { EmptyConnect } from './empty-connect'
import { StepUpload } from './step-upload'
import { StepTerms } from './step-terms'
import { StepReview } from './step-review'
import { StepSign } from './step-sign'
import { StepStatus } from './step-status'

export default function BorrowView() {
  const { account } = useSolana()
  const [state, dispatch] = useBorrowWizard()

  return (
    <div className="space-y-8">
      <BorrowHeader />
      {!account ? (
        <EmptyConnect />
      ) : (
        <>
          <Stepper current={state.step} onJump={(k) => dispatch({ type: 'GO', step: k })} />
          {state.error ? (
            <ErrorToast
              message={state.error.message}
              code={state.error.code}
              onClose={() => dispatch({ type: 'CLEAR_ERROR' })}
            />
          ) : null}
          {state.step === 'upload' ? (
            <StepUpload state={state} dispatch={dispatch} account={account} />
          ) : null}
          {state.step === 'terms' ? <StepTerms state={state} dispatch={dispatch} /> : null}
          {state.step === 'review' ? (
            <StepReview state={state} dispatch={dispatch} account={account} />
          ) : null}
          {state.step === 'sign' ? (
            <StepSign state={state} dispatch={dispatch} account={account} />
          ) : null}
          {state.step === 'status' ? <StepStatus state={state} dispatch={dispatch} /> : null}
        </>
      )}
    </div>
  )
}

function BorrowHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          borrow & deploy
        </div>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-tight">
          ship your <span className="text-accent">.so</span> file.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload bytecode → set terms → sign → auto-deploy. ~60 seconds end-to-end.
        </p>
      </div>
    </div>
  )
}

function Stepper({
  current,
  onJump,
}: {
  current: WizardStep
  onJump: (k: WizardStep) => void
}) {
  const idx = STEPS.findIndex((s) => s.k === current)
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const isActive = i === idx
        const isDone = i < idx
        return (
          <div key={s.k} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => (isDone || isActive ? onJump(s.k) : null)}
              disabled={!isDone && !isActive}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs transition ${
                isActive
                  ? 'border-accent bg-accent/5 text-foreground'
                  : isDone
                    ? 'border-border text-muted-foreground hover:text-foreground'
                    : 'border-border text-muted-foreground opacity-50'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                  isActive
                    ? 'border-accent text-accent'
                    : isDone
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border'
                }`}
              >
                {isDone ? '✓' : s.n}
              </span>
              <span>{s.t}</span>
            </button>
            {i < STEPS.length - 1 ? (
              <span
                className={`h-px flex-1 ${i < idx ? 'bg-accent' : 'bg-border'}`}
                aria-hidden
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ErrorToast({
  message,
  code,
  onClose,
}: {
  message: string
  code: string
  onClose: () => void
}) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">
            ⚠ error · {code}
          </div>
          <div className="mt-1 font-mono text-xs">{message}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="font-mono text-xs">
          dismiss
        </Button>
      </CardContent>
    </Card>
  )
}
