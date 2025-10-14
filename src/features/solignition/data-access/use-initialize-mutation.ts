import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getInitializeInstructionAsync } from '@project/anchor'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'

type InitializeParams = {
  adminFeeSplitBps: number
  defaultInterestRateBps: number
  defaultAdminFeeBps: number
  deployer: Address
}

export function useInitializeProtocolMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async (params: InitializeParams) => {
      const instruction = await getInitializeInstructionAsync({
        admin: signer,
        deployer: params.deployer,
        adminFeeSplitBps: params.adminFeeSplitBps,
        defaultInterestRateBps: params.defaultInterestRateBps,
        defaultAdminFeeBps: params.defaultAdminFeeBps,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Protocol initialized successfully')
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}