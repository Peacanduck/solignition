import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

type UpdateConfigParams = {
  adminFeeSplitBps?: number
  defaultInterestRateBps?: number
  defaultAdminFeeBps?: number
  deployer?: string
  treasury?: string
  admin?: string
}

export function useUpdateConfigMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async (params: UpdateConfigParams) => {
      const adminPubkey = new PublicKey(account.address)

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        program.programId
      )

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        program.programId
      )

      const tx = await program.methods
        .updateConfig(
          params.adminFeeSplitBps ?? null,
          params.defaultInterestRateBps ?? null,
          params.defaultAdminFeeBps ?? null,
          params.deployer ? new PublicKey(params.deployer) : null,
          params.treasury ? new PublicKey(params.treasury) : null,
          params.admin ? new PublicKey(params.admin) : null
        )
        .accounts({
          admin: adminPubkey,
          protocolConfig,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      return tx
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Protocol config updated successfully')
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
    },
  })
}

/*import { useMutation, useQueryClient } from '@tanstack/react-query'
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
        eventAuthority: signer.address, //placeholder
        program: SOLIGNITION_PROGRAM_ADDRESS,
        admin: signer,
        adminArg: signer.address, //placeholder
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
}*/