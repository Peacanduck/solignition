import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UiWalletAccount } from '@wallet-ui/react'
import { toast } from 'sonner'
import { useFetchSigned } from '@/lib/fetch-signed'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

export interface UploadedProgram {
  fileId: string
  fileName: string
  borrower: string
  filePath: string
  fileSize: number
  binaryHash: string
  estimatedCost: number
  status: 'pending' | 'ready' | 'deployed'
  createdAt: number
  loanId?: string
  deployedProgramId?: string
}

export interface PaginatedUploadsResponse {
  uploads: UploadedProgram[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

// v1 returns the paginated envelope for every list call. The unpaginated
// hook below is a thin wrapper that asks for the server-cap-sized page and
// hands callers just the array, preserving the old call sites' shape.
function buildUploadsListUrl({
  borrower,
  status,
  limit,
  offset,
}: {
  borrower: string
  status?: 'pending' | 'ready' | 'deployed'
  limit: number
  offset: number
}): string {
  const params = new URLSearchParams({
    borrower,
    limit: limit.toString(),
    offset: offset.toString(),
    ...(status && { status }),
  })
  return `${DEPLOYER_API_URL}/v1/uploads?${params}`
}

// Hook to fetch all uploads for a borrower (returns the array directly).
export function useUploadedPrograms({
  account,
  status,
}: {
  account: UiWalletAccount
  status?: 'pending' | 'ready' | 'deployed'
}) {
  const fetchSigned = useFetchSigned(account)

  return useQuery({
    queryKey: ['uploaded-programs', account.address, status],
    queryFn: async () => {
      const url = buildUploadsListUrl({
        borrower: account.address,
        status,
        limit: 200,
        offset: 0,
      })
      const response = await fetchSigned(url)

      if (!response.ok) {
        if (response.status === 404) {
          return []
        }
        throw new Error('Failed to fetch uploaded programs')
      }

      const data: PaginatedUploadsResponse = await response.json()
      return data.uploads
    },
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('404')) {
        return false
      }
      return failureCount < 2
    },
  })
}

// Hook to fetch paginated uploads (returns the full envelope).
export function useUploadedProgramsPaginated({
  account,
  limit = 10,
  offset = 0,
  status,
}: {
  account: UiWalletAccount
  limit?: number
  offset?: number
  status?: 'pending' | 'ready' | 'deployed'
}) {
  const fetchSigned = useFetchSigned(account)

  return useQuery({
    queryKey: ['uploaded-programs-paginated', account.address, limit, offset, status],
    queryFn: async () => {
      const url = buildUploadsListUrl({ borrower: account.address, status, limit, offset })
      const response = await fetchSigned(url)
      if (!response.ok) {
        throw new Error('Failed to fetch uploaded programs')
      }
      const data: PaginatedUploadsResponse = await response.json()
      return data
    },
  })
}

// Hook to delete an uploaded program
export function useDeleteUploadedProgram({ account }: { account: UiWalletAccount }) {
  const queryClient = useQueryClient()
  const fetchSigned = useFetchSigned(account)

  return useMutation({
    mutationFn: async (fileId: string) => {
      // v1 DELETE authorizes via X-Auth-Pubkey alone (no body), and
      // returns 204 No Content on success.
      const response = await fetchSigned(`${DEPLOYER_API_URL}/v1/uploads/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete upload')
      }
      // 204 has no body; nothing to parse.
      return { success: true as const }
    },
    onSuccess: () => {
      toast.success('Program deleted successfully')
      // Invalidate all upload queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['uploaded-programs'] })
      queryClient.invalidateQueries({ queryKey: ['uploaded-programs-paginated'] })
    },
    onError: (error: Error) => {
      toast.error('Failed to delete program', {
        description: error.message,
      })
    },
  })
}

// Hook to upload a program file (alternate entry point — also exposed via
// use-upload-program-file.ts for callers that don't need query invalidation).
export function useUploadProgramFile({ account }: { account: UiWalletAccount }) {
  const queryClient = useQueryClient()
  const fetchSigned = useFetchSigned(account)

  return useMutation({
    mutationFn: async ({ file, borrower }: { file: File; borrower: string }) => {
      const fileBytes = new Uint8Array(await file.arrayBuffer())

      const formData = new FormData()
      formData.append('file', file)
      formData.append('borrower', borrower)

      const response = await fetchSigned(`${DEPLOYER_API_URL}/v1/uploads`, {
        method: 'POST',
        body: formData,
        fileBytes,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      return data
    },
    onSuccess: (data) => {
      // Invalidate uploads list to include the new upload
      console.log('Upload successful', data)
      queryClient.invalidateQueries({ queryKey: ['uploaded-programs'] })
      queryClient.invalidateQueries({ queryKey: ['uploaded-programs-paginated'] })
    },
    onError: (error: Error) => {
      toast.error('Failed to upload program file', {
        description: error.message,
      })
    },
  })
}
