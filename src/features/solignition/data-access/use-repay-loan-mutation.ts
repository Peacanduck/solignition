
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { toast } from 'sonner'
import { useSolana } from '@/components/solana/use-solana'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

interface NotifyRepaidResponse {
  success: boolean
  message: string
  signature: string
  status?: string
  loanId?: string
  auth?: string
}

export function useRepayLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async ({ 
      loanAddress, 
      loanId 
    }: { 
      loanAddress: string
      programData?: string
      loanId: bigint 
    }) => {
      const borrowerPubkey = new PublicKey(account.address)
      const loanPubkey = new PublicKey(loanAddress)

      const [protocolConfig] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
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

      let signature = null

      try {
        signature = await program.methods
          .repayLoan(new BN(loanId.toString()))
          .accounts({
            borrower: borrowerPubkey,
            loan: loanPubkey,
            protocolConfig,
            vault,
            adminPda,
            systemProgram: SystemProgram.programId,
            eventAuthority,
            program: program.programId,
          })
          .rpc()
      } catch (error) {
        console.error('Error repaying loan:', error)
        throw error
      }

      // Notify the deployer the loan was repaid
      toast.info('Notifying deployer service...', {
        description: 'Triggering auth transfer',
      })

      try {
        const notifyResponse = await fetch(`${DEPLOYER_API_URL}/notify-repaid`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature,
            borrower: account.address,
            loanId: loanId.toString(),
          }),
        })

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json()
          console.log('Deployer notification failed', errorData)
          toast.warning('Loan repaid but auth transfer failed', {
            description: 'Please contact support if you dont have ownership of your program',
          })
        } else {
          const notifyData: NotifyRepaidResponse = await notifyResponse.json()
          console.log('Deployer notified successfully', notifyData)
          toast.success('Auth transfer initiated', {
            description: 'Program ownership will be transferred to you',
          })
        }
      } catch (notifyError) {
        toast.warning('Repaid but could not notify deployer for auth transfer', {
          description: 'Transfer can still be processed automatically',
        })
      }

      return signature
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
    onError: (error: Error) => {
      toast.error('Failed to repay loan', {
        description: error.message,
      })
    },
  })
}

/*import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getRepayLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import {  getProgramDerivedAddress } from '@solana/kit'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'
import { toast } from 'sonner'
//import {  PublicKey } from '@solana/web3.js'
//import { useProtocolConfig } from './use-protocol-config'
const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

interface NotifyRepaidResponse {
  success: boolean
  message: string
  signature: string
  status?: string
  loanId?: string
  auth?: string
}

export function useRepayLoanMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()
 // const protocolConfigQuery = useProtocolConfig()
  
  return useMutation({
    mutationFn: async ({ loanAddress, programData, loanId }: { loanAddress: Address; programData: Address, loanId: BigInt }) => {
      let loanID = BigInt(loanId.toString());
      console.log('progData',programData);
      // Derive protocol config PDA
      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      const [vault] = await getProgramDerivedAddress({
      programAddress: SOLIGNITION_PROGRAM_ADDRESS,
      seeds: [new TextEncoder().encode('vault')], // Matches VAULT_SEED
      })
  
      let signature = null;
      try {
        const instruction = await getRepayLoanInstructionAsync({
        program: SOLIGNITION_PROGRAM_ADDRESS,
        borrower: signer,
        loan: loanAddress,
        protocolConfig,
       // programData,
        vault,
       // deployer: protocolConfigQuery.data?.data.deployer,
        loanId: loanID,
        })
      
        signature = await signAndSend(instruction, signer);

      } catch (error) {
        console.error('Error repaying loan:', error);
        throw error;
      }

      // Step 3: Notify the deployer the loan was repaid
            toast.info('Notifying deployer service...', {
              description: 'Triggering auth transfer',
            })
      
            try {
              const notifyResponse = await fetch(`${DEPLOYER_API_URL}/notify-repaid`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  signature,
                  borrower: account.address,
                  loanId: loanId.toString(),
                }),
              })
      
              if (!notifyResponse.ok) {
                const errorData = await notifyResponse.json()
               // toast.error('Failed to notify deployer', { errorData })
               console.log('Deployer notification failed', { errorData });
                toast.warning('Loan repaid but auth transfer failed', {
                  description: 'Please contact support if you dont have ownership of your program',
                })
              } else {
                const notifyData: NotifyRepaidResponse = await notifyResponse.json()
                //logger.info('Deployer notified successfully', { notifyData })
                console.log('Deployer notified successfully', { notifyData });
                toast.warning('Loan repaid but auth transfer failed', {
                  description: 'Please contact support if you dont have ownership of your program',
                })
              }
            } catch (notifyError) {
              //logger.error('Error notifying deployer', { notifyError })
              toast.warning('Repaid but could not notify deployer for auth transfer', {
                description: 'still can be processed automatically',
              })
            }
            return signature;
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
    onError: (error: Error) => {
          toast.error('Failed to repay loan', {
            description: error.message,
          })
        },
  })
}*/