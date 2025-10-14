import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getDepositInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'

export function useDepositMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async (amount: bigint) => {
      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      const instruction = await getDepositInstructionAsync({
        depositor: signer,
        protocolConfig,
        amount,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Deposit successful')
      await queryClient.invalidateQueries({
        queryKey: ['depositor-record', { cluster: cluster.id, owner: account.address }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}