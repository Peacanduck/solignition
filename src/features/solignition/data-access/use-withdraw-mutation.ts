// src/features/solignition/data-access/use-withdraw-mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

export function useWithdrawMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async (shares: bigint) => {
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

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        program.programId
      )

      const tx = await program.methods
        .withdraw(new BN(shares.toString()))
        .accounts({
          depositor: depositorPubkey,
          depositorRecord,
          protocolConfig,
          vault,
          systemProgram: SystemProgram.programId,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      return tx
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Withdrawal successful')
      await queryClient.invalidateQueries({
        queryKey: ['depositor-record', { cluster: cluster.id, owner: account.address }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}

/*import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getWithdrawInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'

export function useWithdrawMutation({ account }: { account: UiWalletAccount }) {
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

      const instruction = await getWithdrawInstructionAsync({
        program: SOLIGNITION_PROGRAM_ADDRESS,
        depositor: signer,
        protocolConfig,
        shares: amount,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Withdrawal successful')
      await queryClient.invalidateQueries({
        queryKey: ['depositor-record', { cluster: cluster.id, owner: account.address }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}*/