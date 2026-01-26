import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { toast } from 'sonner'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'
import { useProtocolConfig } from './use-protocol-config'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

type RequestLoanParams = {
  principal: bigint
  duration: bigint
  interestRateBps: number
  adminFeeBps: number
  fileId: string
  useExisting: boolean
}

interface NotifyLoanResponse {
  success: boolean
  message: string
  signature: string
  fileId?: string
  status?: string
  loanId?: string
}

export function useRequestLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()
  const protocolConfigQuery = useProtocolConfig()

  return useMutation({
    mutationFn: async (params: RequestLoanParams) => {
      if (!protocolConfigQuery.data) {
        throw new Error('Protocol config not loaded')
      }

      toast.info('Requesting loan...', {
        description: 'Please approve the transaction in your wallet',
      })

      const borrowerPubkey = new PublicKey(account.address)
      const loanId = protocolConfigQuery.data.data.loanCounter

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        program.programId
      )

      const [loanPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('loan'),
          new BN(loanId.toString()).toArrayLike(Buffer, 'le', 8),
          borrowerPubkey.toBuffer(),
        ],
        program.programId
      )

      const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        program.programId
      )

      const [adminPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('admin')],
        program.programId
      )

      const [eventAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('__event_authority')],
        program.programId
      )

      const deployerPubkey = new PublicKey(protocolConfigQuery.data.data.deployer)

      const signature = await program.methods
        .requestLoan(
          new BN(params.principal.toString()),
          new BN(params.duration.toString()),
          params.interestRateBps,
          params.adminFeeBps
        )
        .accounts({
          borrower: borrowerPubkey,
          loan: loanPda,
          protocolConfig,
          vault,
          adminPda,
          deployer: deployerPubkey,
          systemProgram: SystemProgram.programId,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      // Notify the deployer about the loan request
      toast.info('Notifying deployment service...', {
        description: 'Triggering automatic deployment',
      })

      try {
        const notifyResponse = await fetch(`${DEPLOYER_API_URL}/notify-loan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature,
            borrower: account.address,
            loanId: loanId.toString(),
            fileId: params.fileId,
          }),
        })

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json()
          console.log('Loan created but deployment notification failed', errorData)
          toast.warning('Loan created but deployment notification failed', {
            description: 'Please contact support if your program is not deployed',
          })
        } else {
          const notifyData: NotifyLoanResponse = await notifyResponse.json()
          console.log('Deployer notified successfully', notifyData)
        }
      } catch (notifyError) {
        console.error('Error notifying deployer', notifyError)
        toast.warning('Loan created but could not notify deployer', {
          description: 'The deployment may still be processed automatically',
        })
      }

      return signature
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Loan requested successfully')
      toast.info('Deployment in progress', {
        description: 'Your program will be deployed automatically once the loan is approved',
      })
      await queryClient.invalidateQueries({
        queryKey: ['loans', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['uploaded-programs'],
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to request loan', {
        description: error.message,
      })
    },
  })
}

/*import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as anchor from '@coral-xyz/anchor';
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getRequestLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import { useProtocolConfig } from './use-protocol-config'
import { toast } from 'sonner'
import {  PublicKey } from "@solana/web3.js";

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

type RequestLoanParams = {
  principal: bigint
  duration: bigint
  interestRateBps: number
  adminFeeBps: number
  fileId: string
  useExisting: boolean
}

interface NotifyLoanResponse {
  success: boolean
  message: string
  signature: string
  fileId?: string
  status?: string
  loanId?: string
}

export function useRequestLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()
  const protocolConfigQuery = useProtocolConfig()

  return useMutation({
    mutationFn: async (params: RequestLoanParams) => {
      if (!protocolConfigQuery.data) {
        throw new Error('Protocol config not loaded')
      }

      // Since we already have the fileId, we can skip the upload step
      const fileId = params.fileId
      
      toast.info('Requesting loan...', {
        description: 'Please approve the transaction in your wallet',
      })

      const loanId = protocolConfigQuery.data.data.loanCounter

      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })


      const [loanPda] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [
          new TextEncoder().encode('loan'),
          (new anchor.BN(loanId)).toArrayLike(Buffer, "le", 8), 
          new PublicKey(signer.address).toBuffer()
        ],
      });

      const instruction = await getRequestLoanInstructionAsync({
        program: SOLIGNITION_PROGRAM_ADDRESS,
        borrower: signer,
        protocolConfig,
        deployer: protocolConfigQuery.data.data.deployer,
        loan: loanPda,
        principal: params.principal,
        duration: params.duration, //2400n ~40min value for testing
        interestRateBps: params.interestRateBps,
        adminFeeBps: params.adminFeeBps,
      })

      const signature = await signAndSend(instruction, signer);

      // Step 3: Notify the deployer about the loan request
      toast.info('Notifying deployment service...', {
        description: 'Triggering automatic deployment',
      })

      try {
        const notifyResponse = await fetch(`${DEPLOYER_API_URL}/notify-loan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature,
            borrower: account.address,
            loanId: loanId.toString(),
            fileId, // Pass the file ID directly
          }),
        })

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json()
          console.log('Loan created but deployment notification failed', { errorData });
          toast.warning('Loan created but deployment notification failed', {
            description: 'Please contact support if your program is not deployed',
          })
        } else {
          const notifyData: NotifyLoanResponse = await notifyResponse.json()
          console.log('Deployer notified successfully', notifyData)
        }
      } catch (notifyError) {
        console.error('Error notifying deployer', notifyError)
        toast.warning('Loan created but could not notify deployer', {
          description: 'The deployment may still be processed automatically',
        })
      }

      return signature
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Loan requested successfully')
      toast.info('Deployment in progress', {
        description: 'Your program will be deployed automatically once the loan is approved',
      })
      await queryClient.invalidateQueries({
        queryKey: ['loans', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['protocol-config', { cluster: cluster.id }],
      })
      await queryClient.invalidateQueries({
        queryKey: ['uploaded-programs'],
      })
    },
    onError: (error: Error) => {
      toast.error('Failed to request loan', {
        description: error.message,
      })
    },
  })
} */