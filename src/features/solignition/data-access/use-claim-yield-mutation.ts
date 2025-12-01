// src/features/solignition/data-access/use-claim-yield-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getClaimAdminInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'

export function useClaimAdminMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async () => {
      const instruction = await getClaimAdminInstructionAsync({
        admin: signer,
        program: SOLIGNITION_PROGRAM_ADDRESS,
        // Optional parameters will be derived automatically:
        // - adminPda (derived from 'admin' seed)
        // - protocolConfig (derived from 'config' seed)
        // - systemProgram (defaults to '11111111111111111111111111111111')
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Yield claimed successfully')
    },
  })
}