// src/features/solignition/data-access/use-deposit-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { toast } from 'sonner'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

export function useDepositMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async (amount: bigint) => {
      const depositorPubkey = new PublicKey(account.address)

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        program.programId
      )

      const [depositorRecord] = PublicKey.findProgramAddressSync(
        [Buffer.from('depositor'), depositorPubkey.toBuffer()],
        program.programId
      )

      const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        program.programId
      )

      const tx = await program.methods
        .deposit(new BN(amount.toString()))
        .accounts({
          depositor: depositorPubkey,
          depositorRecord,
          protocolConfig,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return tx
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
      toast.error('Failed to deposit', {
        description: error.message,
      })
    },
  })
}
/*import { useMutation, useQueryClient } from '@tanstack/react-query'
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
  seeds: [
    new TextEncoder().encode('depositor'),
    getAddressEncoder().encode(signer.address) // Correct byte encoding
  ],
})

  const [vault] = await getProgramDerivedAddress({
    programAddress: SOLIGNITION_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode('vault')],
  })

  const instruction = await getDepositInstructionAsync({
    depositor: signer,
    depositorRecord,
    protocolConfig,
    vault,
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
}*/