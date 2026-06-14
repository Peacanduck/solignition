import { useReducer } from 'react'

export type WizardStep = 'upload' | 'terms' | 'review' | 'sign' | 'status'

export type DeploymentEvent = {
  title: string
  tx: string | null
  status: 'pending' | 'observed' | 'confirmed' | 'failed'
}

export type WizardError = { code: string; message: string }

export type WizardState = {
  step: WizardStep
  file: File | null
  fileId: string | null
  estimatedRent: bigint | null
  binaryHash: string | null
  duration: 7 | 30 | 60 | 90
  interestRateBps: number
  autoRollover: boolean
  signature: string | null
  loanId: bigint | null
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
  | { type: 'FILE_SELECTED'; file: File }
  | { type: 'FILE_UPLOADED'; fileId: string; estimatedRent: bigint; binaryHash: string }
  | { type: 'FILE_RESET' }
  | { type: 'SET_DURATION'; duration: 7 | 30 | 60 | 90 }
  | { type: 'TOGGLE_ROLLOVER' }
  | { type: 'SIGNED'; signature: string; loanId: bigint }
  | { type: 'PROGRAM_DEPLOYED'; programId: string }
  | { type: 'EVENTS_UPDATED'; events: DeploymentEvent[] }
  | { type: 'ERROR'; error: WizardError }
  | { type: 'CLEAR_ERROR' }

const initial: WizardState = {
  step: 'upload',
  file: null,
  fileId: null,
  estimatedRent: null,
  binaryHash: null,
  duration: 30,
  interestRateBps: DURATION_RATES[30],
  autoRollover: false,
  signature: null,
  loanId: null,
  programId: null,
  deploymentEvents: [],
  error: null,
}

function reducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'GO':
      return { ...s, step: a.step, error: null }
    case 'FILE_SELECTED':
      return { ...s, file: a.file, fileId: null, estimatedRent: null, binaryHash: null, error: null }
    case 'FILE_UPLOADED':
      return {
        ...s,
        fileId: a.fileId,
        estimatedRent: a.estimatedRent,
        binaryHash: a.binaryHash,
        error: null,
      }
    case 'FILE_RESET':
      return { ...s, file: null, fileId: null, estimatedRent: null, binaryHash: null }
    case 'SET_DURATION':
      return { ...s, duration: a.duration, interestRateBps: DURATION_RATES[a.duration] }
    case 'TOGGLE_ROLLOVER':
      return { ...s, autoRollover: !s.autoRollover }
    case 'SIGNED':
      return { ...s, signature: a.signature, loanId: a.loanId, error: null }
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
  return useReducer(reducer, initial)
}

export const STEPS: { k: WizardStep; n: string; t: string }[] = [
  { k: 'upload', n: '01', t: 'upload' },
  { k: 'terms', n: '02', t: 'terms' },
  { k: 'review', n: '03', t: 'review' },
  { k: 'sign', n: '04', t: 'sign' },
  { k: 'status', n: '05', t: 'status' },
]

export const NETWORK_FEE_LAMPORTS = 5_000_000n // ~0.005 SOL

export function computePrincipal(rent: bigint, adminFeeBps: number): {
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
  return (
    (principal * BigInt(rateBps) * BigInt(durationDays)) /
    (10_000n * 365n)
  )
}
