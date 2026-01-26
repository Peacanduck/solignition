import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getDepositInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getAddressEncoder, getProgramDerivedAddress } from '@solana/kit'
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

      const [depositorRecord] = await getProgramDerivedAddress({
  programAddress: SOLIGNITION_PROGRAM_ADDRESS,
  seeds: [Buffer.from('depositor'), getAddressEncoder().encode(signer.address)],
});

const [vault] = await getProgramDerivedAddress({
  programAddress: SOLIGNITION_PROGRAM_ADDRESS,
  seeds: [Buffer.from('vault')],
});

      const instruction = await getDepositInstructionAsync({
        systemProgram: SOLIGNITION_PROGRAM_ADDRESS,
        depositorRecord,
        vault,
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
    onError: (error: Error) => {
       queryClient.invalidateQueries({
        queryKey: ['depositor-record', { cluster: cluster.id, owner: account.address }],
      })
       queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
          toastTx("erer", `Error Deposit Unsuccessful: ${error.message}`)
        },
  })
}