import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

export function useRecoverLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async (loanAddress: string) => {
      const adminPubkey = new PublicKey(account.address)
      const loanPubkey = new PublicKey(loanAddress)

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        program.programId
      )

      const [adminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin')],
        program.programId
      )

      const [treasury] = PublicKey.findProgramAddressSync(
        [Buffer.from('treasury')],
        program.programId
      )

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        program.programId
      )

      const tx = await program.methods
        .recoverLoan()
        .accounts({
          admin: adminPubkey,
          protocolConfig,
          loan: loanPubkey,
          deployer: adminPubkey, // placeholder
          adminPda,
          treasury,
          systemProgram: SystemProgram.programId,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      return tx
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Loan recovered successfully')
      await queryClient.invalidateQueries({
        queryKey: ['loans', { cluster: cluster.id }],
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
import { getRecoverLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'

export function useRecoverLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async (loanAddress: Address) => {
      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      // Derive treasury PDA
      const [treasury] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('treasury')],
      })

      const instruction = await getRecoverLoanInstructionAsync({
        deployer: signer, //placehokder
        program: SOLIGNITION_PROGRAM_ADDRESS,
        admin: signer,
        protocolConfig,
        loan: loanAddress,
        treasury,
      })

      return await signAndSend(instruction, signer)
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Loan recovered successfully')
      await queryClient.invalidateQueries({
        queryKey: ['loans', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}*/