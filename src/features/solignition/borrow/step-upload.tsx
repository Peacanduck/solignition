import { useRef, useState } from 'react'
import type { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUploadProgramFile } from '../data-access/use-upload-program-file'
import { formatSOL } from '../lib/format'
import type { WizardAction, WizardState } from './use-borrow-wizard'

const MAX_BYTES = 1024 * 1024 // 1 MB; TODO: pull from server config

export function StepUpload({
  state,
  dispatch,
  account,
}: {
  state: WizardState
  dispatch: React.Dispatch<WizardAction>
  account: UiWalletAccount
}) {
  const upload = useUploadProgramFile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const startUpload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      dispatch({
        type: 'ERROR',
        error: { code: 'FILE_TOO_LARGE', message: `${(file.size / 1024).toFixed(0)} KB exceeds ${MAX_BYTES / 1024} KB limit` },
      })
      return
    }
    dispatch({ type: 'FILE_SELECTED', file })
    try {
      const res = await upload.mutateAsync({ file, borrower: account.address })
      dispatch({
        type: 'FILE_UPLOADED',
        fileId: res.fileId,
        // server returns SOL; convert to lamports
        estimatedRent: BigInt(Math.floor(res.estimatedCost * 1e9)),
        binaryHash: res.binaryHash,
      })
    } catch (e: any) {
      dispatch({ type: 'ERROR', error: { code: 'UPLOAD_FAILED', message: e?.message ?? 'Upload failed' } })
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) startUpload(f)
  }

  const reset = () => {
    dispatch({ type: 'FILE_RESET' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const continueDisabled = !state.fileId || upload.isPending

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_320px]">
      <Card className="p-6">
        <CardContent className="space-y-5 p-0">
          <StepHead n="01 · upload" title="drop your" titleAccent=".so" titleRest=" file">
            Compiled BPF bytecode. We auto-estimate rent + transaction fees.
          </StepHead>

          {!state.file ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center transition ${
                drag ? 'border-accent bg-accent/5' : 'border-border hover:bg-secondary/50'
              }`}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
                <rect
                  x="6"
                  y="4"
                  width="28"
                  height="32"
                  rx="2"
                  className="stroke-muted-foreground"
                  strokeWidth="1.5"
                />
                <path
                  d="M14 18 L20 12 L26 18 M20 12 L20 26"
                  className="stroke-accent"
                  strokeWidth="1.5"
                />
              </svg>
              <div className="font-mono text-sm">drag & drop your .so file</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                or click to browse · max {MAX_BYTES / 1024} KB
              </div>
              <div className="mt-2 rounded bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                $ solignition deploy ./target/deploy/my_program.so
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-3">
              <div className="rounded bg-accent/15 px-2 py-1 font-mono text-xs text-accent">.SO</div>
              <div className="flex-1">
                <div className="font-mono text-sm">{state.file.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {(state.file.size / 1024).toFixed(0)} KB ·{' '}
                  {upload.isPending
                    ? 'uploading…'
                    : state.fileId
                      ? 'uploaded'
                      : state.error
                        ? 'error'
                        : 'pending'}
                </div>
              </div>
              <button
                onClick={reset}
                className="font-mono text-lg text-muted-foreground hover:text-foreground"
                aria-label="remove file"
              >
                ×
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".so"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) startUpload(f)
            }}
          />

          {state.file && state.fileId ? (
            <ValidationRows
              size={state.file.size}
              rent={state.estimatedRent}
              hash={state.binaryHash}
            />
          ) : null}

          {upload.isPending ? (
            <div className="space-y-1">
              <div className="font-mono text-[11px] text-muted-foreground">uploading…</div>
              <div className="h-1 w-full overflow-hidden rounded bg-secondary">
                <div className="h-full w-1/3 animate-pulse rounded bg-accent" />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={reset} disabled={!state.file}>
              cancel
            </Button>
            <Button
              disabled={continueDisabled}
              onClick={() => dispatch({ type: 'GO', step: 'terms' })}
            >
              continue → terms
            </Button>
          </div>
        </CardContent>
      </Card>

      <SidePanel
        title="WHAT IS A .SO FILE?"
        rows={[
          ['format', 'compiled BPF bytecode'],
          ['source', 'anchor build / cargo build-sbf'],
          ['typical size', '50–500 KB'],
          ['typical cost', '2–6 SOL'],
        ]}
        tip="Run `anchor build` in your workspace to produce target/deploy/<name>.so"
      />
    </div>
  )
}

export function StepHead({
  n,
  title,
  titleAccent,
  titleRest,
  children,
}: {
  n: string
  title: string
  titleAccent?: string
  titleRest?: string
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">step {n}</div>
      <h2 className="font-mono text-3xl font-semibold tracking-tight">
        {title}
        {titleAccent ? <span className="text-accent">{titleAccent}</span> : null}
        {titleRest}
      </h2>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  )
}

function ValidationRows({
  size,
  rent,
  hash,
}: {
  size: number
  rent: bigint | null
  hash: string | null
}) {
  const rows: [string, string, string][] = [
    ['✓', 'bytecode format', 'BPF · ELF · valid'],
    ['✓', 'size check', `${(size / 1024).toFixed(0)} KB / ${MAX_BYTES / 1024} KB max`],
    ['✓', 'estimated rent', rent ? `${formatSOL(rent, 4)} SOL` : '—'],
    ['✓', 'network fees', '~0.005 SOL'],
    ['✓', 'binary hash', hash ? `${hash.slice(0, 10)}…` : '—'],
    ['✓', 'program ID', 'will be assigned at deploy'],
  ]
  return (
    <div className="space-y-1 rounded-md bg-secondary/50 px-3 py-2">
      {rows.map(([s, k, v]) => (
        <div key={k} className="flex items-center gap-2 font-mono text-xs">
          <span className="text-accent">{s}</span>
          <span className="flex-1">{k}</span>
          <span className="text-muted-foreground">{v}</span>
        </div>
      ))}
    </div>
  )
}

export function SidePanel({
  title,
  rows,
  tip,
}: {
  title: string
  rows: [string, string][]
  tip?: string
}) {
  return (
    <Card className="p-5">
      <CardContent className="space-y-3 p-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </div>
        <div className="space-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
        {tip ? <div className="rounded bg-secondary p-2 font-mono text-[11px]">{tip}</div> : null}
      </CardContent>
    </Card>
  )
}
