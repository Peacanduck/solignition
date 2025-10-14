import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getUpdateConfigInstruction, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'

type UpdateConfigParams = {
  adminFeeSplitBps?: number
  defaultInterestRateBps?: number
  defaultAdminFeeBps?: number
  deployer?: Address
  treasury?: Address
}

export function useUpdateConfigMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async (params: UpdateConfigParams) => {
      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      const instruction = getUpdateConfigInstruction({
        admin: signer,
        protocolConfig,
        adminFeeSplitBps: params.adminFeeSplitBps ?? null,
        defaultInterestRateBps: params.defaultInterestRateBps ?? null,
        defaultAdminFeeBps: params.defaultAdminFeeBps ?? null,
        deployer: params.deployer ?? null,
        treasury: params.treasury ?? null,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Protocol config updated successfully')
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}