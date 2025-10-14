import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getRepayLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'

export function useRepayLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async ({ loanAddress, programData }: { loanAddress: Address; programData: Address }) => {
      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      const instruction = await getRepayLoanInstructionAsync({
        borrower: signer,
        loan: loanAddress,
        protocolConfig,
        programData,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Loan repaid successfully')
      await queryClient.invalidateQueries({
        queryKey: ['loans', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}