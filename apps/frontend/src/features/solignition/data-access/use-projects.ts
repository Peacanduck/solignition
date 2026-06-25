import { useQuery } from '@tanstack/react-query'
import type { UiWalletAccount } from '@wallet-ui/react'
import { useSolana } from '@/components/solana/use-solana'
import type { ProjectRecord, ProjectStatus } from './use-project'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

/** Lightweight list entry — the record plus its aggregate status (no per-program records). */
export interface ProjectSummary {
  project: ProjectRecord
  status: ProjectStatus
}

interface PaginatedProjectsResponse {
  projects: ProjectSummary[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

/**
 * List a borrower's projects (lightweight aggregate per project). Used to join
 * on-chain loans with their off-chain project grouping for display — see
 * `lib/group-loans.ts`.
 */
export function useProjects({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()

  return useQuery({
    queryKey: ['projects', { cluster: cluster.id }, account.address],
    queryFn: async (): Promise<ProjectSummary[]> => {
      const params = new URLSearchParams({
        borrower: account.address,
        limit: '200',
        offset: '0',
      })
      // Public endpoint — no wallet signature, so the dashboard loads project
      // groupings without prompting the wallet to sign.
      const response = await fetch(`${DEPLOYER_API_URL}/v1/projects?${params}`)
      if (!response.ok) {
        if (response.status === 404) return []
        throw new Error('Failed to fetch projects')
      }
      const data: PaginatedProjectsResponse = await response.json()
      return data.projects
    },
    staleTime: 15000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
