import { useQuery } from '@tanstack/react-query'
import type { UiWalletAccount } from '@wallet-ui/react'
import { useSolana } from '@/components/solana/use-solana'
import { useFetchSigned } from '@/lib/fetch-signed'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

/** Aggregate project status, mirrors the deployer's `ProjectStatus` enum. */
export type ProjectStatus = 'pending' | 'deploying' | 'partial' | 'deployed' | 'failed'

/** Per-program loan lifecycle status, mirrors the deployer's `LoanStatus`. */
export type ProgramLoanStatus =
  | 'pending'
  | 'uploading'
  | 'deploying'
  | 'deployed'
  | 'failed'
  | 'repaid'
  | 'expired'

export interface ProjectDeploymentRecord {
  loanId: string
  borrower: string
  programId?: string
  status: 'pending' | 'deploying' | 'deployed' | 'recovering' | 'recovered' | 'failed'
  error?: string
  createdAt: number
  updatedAt: number
  principal: string
}

export interface ProjectProgramRef {
  loanId: string
  fileId: string
  index: number
  name?: string
}

export interface ProjectRecord {
  projectId: string
  borrower: string
  name?: string
  signature: string
  programs: ProjectProgramRef[]
  createdAt: number
  updatedAt: number
}

export interface ProjectProgramStatus extends ProjectProgramRef {
  status: ProgramLoanStatus
  deployment: ProjectDeploymentRecord | null
}

export interface ProjectAggregate {
  project: ProjectRecord
  status: ProjectStatus
  programs: ProjectProgramStatus[]
}

/** Statuses for which the project is still settling and should keep polling. */
const LIVE_STATUSES: ReadonlySet<ProjectStatus> = new Set(['pending', 'deploying', 'partial'])

/**
 * Fetch one project's aggregate + per-program status. Polls every few seconds
 * while the project is still settling (pending / deploying / partial) and stops
 * once it reaches a terminal `deployed` or `failed`. Pass `projectId: null` to
 * disable (e.g. single-program borrows).
 */
export function useProject({
  account,
  projectId,
}: {
  account: UiWalletAccount
  projectId: string | null
}) {
  const { cluster } = useSolana()
  const fetchSigned = useFetchSigned(account)

  return useQuery({
    queryKey: ['project', { cluster: cluster.id }, projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<ProjectAggregate | null> => {
      const response = await fetchSigned(`${DEPLOYER_API_URL}/v1/projects/${projectId}`)
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error('Failed to fetch project')
      }
      return response.json()
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && LIVE_STATUSES.has(status) ? 4000 : false
    },
  })
}
