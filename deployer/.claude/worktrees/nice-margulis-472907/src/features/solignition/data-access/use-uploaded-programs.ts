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

// Hook to fetch all uploads for a borrower
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
      const url = status
        ? `${DEPLOYER_API_URL}/uploads/borrower/${account.address}?status=${status}`
        : `${DEPLOYER_API_URL}/uploads/borrower/${account.address}`

      const response = await fetchSigned(url)

      if (!response.ok) {
        if (response.status === 404) {
          return []
        }
        throw new Error('Failed to fetch uploaded programs')
      }

      const data: UploadedProgram[] = await response.json()
      return data
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

// Hook to fetch paginated uploads
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
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(status && { status }),
      })

      const response = await fetchSigned(
        `${DEPLOYER_API_URL}/uploads/borrower/${account.address}/paginated?${params}`,
      )

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
      // The deployer authorizes the delete using `X-Auth-Pubkey` (signed by
      // the wallet) rather than the body's `borrower`, but we keep the field
      // for compatibility during the v1.1 transition.
      const body = JSON.stringify({ borrower: account.address })
      const response = await fetchSigned(`${DEPLOYER_API_URL}/uploads/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete upload')
      }

      return await response.json()
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

      const response = await fetchSigned(`${DEPLOYER_API_URL}/upload`, {
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
