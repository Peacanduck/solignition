
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

type InitializeParams = {
  adminFeeSplitBps: number
  defaultInterestRateBps: number
  defaultAdminFeeBps: number
  deployer: string
}

export function useInitializeProtocolMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async (params: InitializeParams) => {
      const adminPubkey = new PublicKey(account.address)
      const deployerPubkey = new PublicKey(params.deployer)

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        program.programId
      )

      const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        program.programId
      )

      const [authorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('authority')],
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
        .initialize(
          params.adminFeeSplitBps,
          params.defaultInterestRateBps,
          params.defaultAdminFeeBps
        )
        .accounts({
          admin: adminPubkey,
          protocolConfig,
          vault,
          authorityPda,
          adminPda,
          treasury,
          deployer: deployerPubkey,
          systemProgram: SystemProgram.programId,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      return tx
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Protocol initialized successfully')
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}

/*import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getInitializeInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
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
        program: SOLIGNITION_PROGRAM_ADDRESS,
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
}*/