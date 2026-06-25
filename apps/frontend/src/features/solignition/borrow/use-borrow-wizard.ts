import { useReducer } from 'react'

export type WizardStep = 'upload' | 'terms' | 'review' | 'sign' | 'status'

export type DeploymentEvent = {
  title: string
  tx: string | null
  status: 'pending' | 'observed' | 'confirmed' | 'failed'
}

export type WizardError = { code: string; message: string }

/**
 * One program slot in the borrow wizard. A project bundles 2..4 of these; a
 * length-1 `programs` array is the ordinary single-program borrow and follows
 * the original `/v1/loans` path unchanged.
 */
export type ProgramSlot = {
  file: File | null
  fileId: string | null
  estimatedRent: bigint | null
  binaryHash: string | null
  name: string
}

/** Transaction-size limit caps a project at 4 bundled `request_loan` ixs. */
export const MAX_PROGRAMS_PER_PROJECT = 4

export type WizardState = {
  step: WizardStep
  /** Client-generated project id (UUID); only sent to the deployer when N > 1. */
  projectId: string
  projectName: string
  programs: ProgramSlot[]
  duration: 7 | 30 | 60 | 90
  interestRateBps: number
  autoRollover: boolean
  signature: string | null
  /** Loan ids assigned on sign — one per program, in counter order. */
  loanIds: bigint[]
  programId: string | null
  deploymentEvents: DeploymentEvent[]
  error: WizardError | null
}

// Spec rate map; TODO: replace with protocolConfig.interestRateTiers if added on-chain
export const DURATION_RATES: Record<7 | 30 | 60 | 90, number> = {
  7: 500,
  30: 600,
  60: 750,
  90: 800,
}

export type WizardAction =
  | { type: 'GO'; step: WizardStep }
  | { type: 'ADD_PROGRAM' }
  | { type: 'REMOVE_PROGRAM'; index: number }
  | { type: 'SET_PROGRAM_NAME'; index: number; name: string }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'FILE_SELECTED'; index: number; file: File }
  | { type: 'FILE_UPLOADED'; index: number; fileId: string; estimatedRent: bigint; binaryHash: string }
  | { type: 'FILE_RESET'; index: number }
  | { type: 'SET_DURATION'; duration: 7 | 30 | 60 | 90 }
  | { type: 'TOGGLE_ROLLOVER' }
  | { type: 'SIGNED'; signature: string; loanIds: bigint[] }
  | { type: 'PROGRAM_DEPLOYED'; programId: string }
  | { type: 'EVENTS_UPDATED'; events: DeploymentEvent[] }
  | { type: 'ERROR'; error: WizardError }
  | { type: 'CLEAR_ERROR' }

function emptySlot(): ProgramSlot {
  return { file: null, fileId: null, estimatedRent: null, binaryHash: null, name: '' }
}

function createInitial(): WizardState {
  return {
    step: 'upload',
    projectId: crypto.randomUUID(),
    projectName: '',
    programs: [emptySlot()],
    duration: 30,
    interestRateBps: DURATION_RATES[30],
    autoRollover: false,
    signature: null,
    loanIds: [],
    programId: null,
    deploymentEvents: [],
    error: null,
  }
}

/** Replace the slot at `index` with a patched copy. */
function patchSlot(s: WizardState, index: number, patch: Partial<ProgramSlot>): ProgramSlot[] {
  return s.programs.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
}

function reducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'GO':
      return { ...s, step: a.step, error: null }
    case 'ADD_PROGRAM':
      if (s.programs.length >= MAX_PROGRAMS_PER_PROJECT) return s
      return { ...s, programs: [...s.programs, emptySlot()], error: null }
    case 'REMOVE_PROGRAM':
      if (s.programs.length <= 1) return s
      return { ...s, programs: s.programs.filter((_, i) => i !== a.index), error: null }
    case 'SET_PROGRAM_NAME':
      return { ...s, programs: patchSlot(s, a.index, { name: a.name }) }
    case 'SET_PROJECT_NAME':
      return { ...s, projectName: a.name }
    case 'FILE_SELECTED':
      return {
        ...s,
        programs: patchSlot(s, a.index, {
          file: a.file,
          fileId: null,
          estimatedRent: null,
          binaryHash: null,
        }),
        error: null,
      }
    case 'FILE_UPLOADED':
      return {
        ...s,
        programs: patchSlot(s, a.index, {
          fileId: a.fileId,
          estimatedRent: a.estimatedRent,
          binaryHash: a.binaryHash,
        }),
        error: null,
      }
    case 'FILE_RESET':
      return {
        ...s,
        programs: patchSlot(s, a.index, {
          file: null,
          fileId: null,
          estimatedRent: null,
          binaryHash: null,
        }),
      }
    case 'SET_DURATION':
      return { ...s, duration: a.duration, interestRateBps: DURATION_RATES[a.duration] }
    case 'TOGGLE_ROLLOVER':
      return { ...s, autoRollover: !s.autoRollover }
    case 'SIGNED':
      return { ...s, signature: a.signature, loanIds: a.loanIds, error: null }
    case 'PROGRAM_DEPLOYED':
      return { ...s, programId: a.programId }
    case 'EVENTS_UPDATED':
      return { ...s, deploymentEvents: a.events }
    case 'ERROR':
      return { ...s, error: a.error }
    case 'CLEAR_ERROR':
      return { ...s, error: null }
    default:
      return s
  }
}

export function useBorrowWizard() {
  return useReducer(reducer, undefined, createInitial)
}

export const STEPS: { k: WizardStep; n: string; t: string }[] = [
  { k: 'upload', n: '01', t: 'upload' },
  { k: 'terms', n: '02', t: 'terms' },
  { k: 'review', n: '03', t: 'review' },
  { k: 'sign', n: '04', t: 'sign' },
  { k: 'status', n: '05', t: 'status' },
]

export const NETWORK_FEE_LAMPORTS = 5_000_000n // ~0.005 SOL

export function computePrincipal(
  rent: bigint,
  adminFeeBps: number,
): {
  rent: bigint
  network: bigint
  protocolFee: bigint
  principal: bigint
} {
  const network = NETWORK_FEE_LAMPORTS
  const base = rent + network
  // protocolFee approx on base; close enough vs recursive solve
  const protocolFee = (base * BigInt(adminFeeBps)) / 10_000n
  const principal = base + protocolFee
  return { rent, network, protocolFee, principal }
}

export function computeInterest(principal: bigint, rateBps: number, durationDays: number): bigint {
  // interest = principal * rateBps * duration / (10000 * 365 days) — annualized
  return (principal * BigInt(rateBps) * BigInt(durationDays)) / (10_000n * 365n)
}

// ── Project aggregation helpers ────────────────────────────────────────────
// Each loan carries its OWN principal (computed from its own rent); these sum
// across the program slots for display / totals. A length-1 project is just
// the single-program case.

/** Per-program principal, in program-slot order. */
export function programPrincipals(programs: ProgramSlot[], adminFeeBps: number): bigint[] {
  return programs.map((p) => computePrincipal(p.estimatedRent ?? 0n, adminFeeBps).principal)
}

export function sumPrincipal(programs: ProgramSlot[], adminFeeBps: number): bigint {
  return programPrincipals(programs, adminFeeBps).reduce((a, b) => a + b, 0n)
}

export function sumRent(programs: ProgramSlot[]): bigint {
  return programs.reduce((a, p) => a + (p.estimatedRent ?? 0n), 0n)
}

/** True once every slot has finished uploading (has a fileId). */
export function allUploaded(programs: ProgramSlot[]): boolean {
  return programs.length > 0 && programs.every((p) => !!p.fileId)
}
