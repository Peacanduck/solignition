import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { UiWalletAccount } from '@wallet-ui/react'
import { useFetchSigned } from '@/lib/fetch-signed'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

interface UploadResponse {
  success: boolean
  fileId: string
  estimatedCost: number
  binaryHash: string
  message: string
}

interface UploadError {
  error: string
}

export function useUploadProgramFile({ account }: { account: UiWalletAccount }) {
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
        const errorData: UploadError = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data: UploadResponse = await response.json()
      return data
    },
    onSuccess: (data) => {
      toast.success('Program file uploaded successfully', {
        description: `Estimated deployment cost: ${data.estimatedCost} SOL`,
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to upload program file', {
        description: error.message,
      })
    },
  })
}
