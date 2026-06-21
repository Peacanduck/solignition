import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as anchor from '@coral-xyz/anchor'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getRepayLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import type { IInstruction } from 'gill'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import { toast } from 'sonner'
import { PublicKey } from '@solana/web3.js'
import { useFetchSigned } from '@/lib/fetch-signed'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

type RepayProjectParams = {
  projectId: string
  /** The loan ids belonging to the project (only the still-repayable ones). */
  loanIds: bigint[]
}

interface NotifyProjectRepaidResponse {
  success: boolean
  message: string
  projectId: string
  programs?: Array<{ loanId: string; auth: string }>
}

/**
 * Repay a whole project at once: bundle N `repay_loan` instructions into ONE
 * transaction = one wallet signature, then notify the deployer via POST
 * /v1/projects/:id/repayments so it fans out the N authority transfers back to
 * the borrower. Mirrors `useRepayLoanMutation` but for every loan in a project.
 */
export function useRepayProjectMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()
  const fetchSigned = useFetchSigned(account)

  return useMutation({
    mutationFn: async ({ projectId, loanIds }: RepayProjectParams) => {
      if (loanIds.length === 0) {
        throw new Error('No repayable loans in this project')
      }

      toast.info(`Repaying ${loanIds.length} loans...`, {
        description: 'Please approve the single transaction in your wallet',
      })

      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })
      const [vault] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('vault')],
      })

      const borrowerBuffer = new PublicKey(signer.address).toBuffer()

      const instructions: IInstruction[] = await Promise.all(
        loanIds.map(async (loanId) => {
          const [loanAddress] = await getProgramDerivedAddress({
            programAddress: SOLIGNITION_PROGRAM_ADDRESS,
            seeds: [
              new TextEncoder().encode('loan'),
              new anchor.BN(loanId.toString()).toArrayLike(Buffer, 'le', 8),
              borrowerBuffer,
            ],
          })
          return getRepayLoanInstructionAsync({
            program: SOLIGNITION_PROGRAM_ADDRESS,
            borrower: signer,
            loan: loanAddress,
            protocolConfig,
            vault,
            loanId,
          })
        }),
      )

      // One array of instructions ⇒ one transaction ⇒ one signature.
      const signature = await signAndSend(instructions, signer)

      toast.info('Notifying deployer service...', {
        description: 'Triggering authority transfer for each program',
      })

      try {
        const notifyBody = JSON.stringify({ signature, borrower: account.address })
        const notifyResponse = await fetchSigned(
          `${DEPLOYER_API_URL}/v1/projects/${projectId}/repayments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: notifyBody,
          },
        )

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json()
          console.log('Project repaid but auth-transfer notification failed', { errorData })
          toast.warning('Project repaid but authority transfer failed', {
            description: "Please contact support if you don't have ownership of your programs",
          })
        } else {
          const notifyData: NotifyProjectRepaidResponse = await notifyResponse.json()
          console.log('Deployer notified successfully', { notifyData })
        }
      } catch (notifyError) {
        console.error('Error notifying deployer', notifyError)
        toast.warning('Repaid but could not notify deployer for authority transfer', {
          description: 'It may still be processed automatically',
        })
      }

      return signature
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Project repaid successfully')
      await queryClient.invalidateQueries({ queryKey: ['loans', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['projects', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['protocol-config', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['vault-balance', { cluster: cluster.id }] })
    },
    onError: (error: Error) => {
      toast.error('Failed to repay project', {
        description: error.message,
      })
    },
  })
}
