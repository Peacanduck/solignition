import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as anchor from '@coral-xyz/anchor'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getRequestLoanInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'
import type { IInstruction } from 'gill'
import { toastTx } from '@/components/toast-tx'
import { useSolana } from '@/components/solana/use-solana'
import { useProtocolConfig } from './use-protocol-config'
import { toast } from 'sonner'
import { PublicKey } from '@solana/web3.js'
import { useFetchSigned } from '@/lib/fetch-signed'

const DEPLOYER_API_URL = import.meta.env.VITE_DEPLOYER_API_URL || 'http://localhost:3000'

/** One program slot in a multi-program project request. */
export type ProjectProgramInput = {
  fileId: string
  principal: bigint
  name?: string
}

type RequestProjectParams = {
  /** Client-generated UUID (passed in so a re-POST is idempotent). */
  projectId: string
  projectName?: string
  duration: bigint
  interestRateBps: number
  adminFeeBps: number
  /** Ordered 2..4 program slots; loan ids are derived in this order. */
  programs: ProjectProgramInput[]
}

interface NotifyProjectResponse {
  success: boolean
  message: string
  projectId: string
  signature: string
  programs?: Array<{ loanId: string; fileId: string; index: number; name?: string }>
}

/**
 * Bundle N (2..4) `request_loan` instructions into ONE transaction = one wallet
 * signature, creating a "project". The loan counter is read as late as possible
 * and the loan PDAs are derived for ids `base, base+1, … base+N-1` (the order
 * `request_loan` increments the counter), so the whole tx is atomic: if another
 * borrower's loan lands between the read and the sign, the tx reverts and we can
 * retry. After the on-chain tx, the deployer is notified once via POST
 * /v1/projects with all loan ids + file ids.
 *
 * Single-program borrows do NOT use this — they keep the existing
 * `useRequestLoanMutation` + /v1/loans path.
 */
export function useRequestProjectMutation({ account }: { account: UiWalletAccount }) {
  const { cluster } = useSolana()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()
  const protocolConfigQuery = useProtocolConfig()
  const fetchSigned = useFetchSigned(account)

  return useMutation({
    mutationFn: async (params: RequestProjectParams) => {
      if (!protocolConfigQuery.data) {
        throw new Error('Protocol config not loaded')
      }
      if (params.programs.length < 2) {
        throw new Error('A project needs at least 2 programs')
      }

      toast.info(`Requesting ${params.programs.length} loans...`, {
        description: 'Please approve the single transaction in your wallet',
      })

      // Read the counter as late as possible — this is `base`. Derive ids in
      // counter order: base, base+1, …
      const base = protocolConfigQuery.data.data.loanCounter
      const loanIds = params.programs.map((_, i) => base + BigInt(i))

      const [protocolConfig] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      const borrowerBuffer = new PublicKey(signer.address).toBuffer()

      // Build the N instructions IN COUNTER ORDER (same seeds as the
      // single-loan hook, with `BN(base + i)`).
      const instructions: IInstruction[] = await Promise.all(
        params.programs.map(async (program, i) => {
          const [loanPda] = await getProgramDerivedAddress({
            programAddress: SOLIGNITION_PROGRAM_ADDRESS,
            seeds: [
              new TextEncoder().encode('loan'),
              new anchor.BN(loanIds[i].toString()).toArrayLike(Buffer, 'le', 8),
              borrowerBuffer,
            ],
          })
          return getRequestLoanInstructionAsync({
            program: SOLIGNITION_PROGRAM_ADDRESS,
            borrower: signer,
            protocolConfig,
            deployer: protocolConfigQuery.data!.data.deployer,
            loan: loanPda,
            principal: program.principal,
            duration: params.duration,
            interestRateBps: params.interestRateBps,
            adminFeeBps: params.adminFeeBps,
          })
        }),
      )

      // One array of instructions ⇒ one transaction ⇒ one signature.
      const signature = await signAndSend(instructions, signer)

      // Notify the deployer about the whole project in one call.
      toast.info('Notifying deployment service...', {
        description: 'Triggering automatic deployment of each program',
      })

      try {
        const notifyBody = JSON.stringify({
          projectId: params.projectId,
          borrower: account.address,
          signature,
          ...(params.projectName ? { name: params.projectName } : {}),
          programs: params.programs.map((program, i) => ({
            loanId: loanIds[i].toString(),
            fileId: program.fileId,
            ...(program.name ? { name: program.name } : {}),
          })),
        })
        const notifyResponse = await fetchSigned(`${DEPLOYER_API_URL}/v1/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: notifyBody,
        })

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json()
          console.log('Project created but deployment notification failed', { errorData })
          toast.warning('Project created but deployment notification failed', {
            description: 'Please contact support if your programs are not deployed',
          })
        } else {
          const notifyData: NotifyProjectResponse = await notifyResponse.json()
          console.log('Deployer notified successfully', notifyData)
        }
      } catch (notifyError) {
        console.error('Error notifying deployer', notifyError)
        toast.warning('Project created but could not notify deployer', {
          description: 'The deployments may still be processed automatically',
        })
      }

      return { signature, loanIds }
    },
    onSuccess: async ({ signature }) => {
      toastTx(signature, 'Project requested successfully')
      toast.info('Deployments in progress', {
        description: 'Each program will be deployed automatically once the loans are approved',
      })
      await queryClient.invalidateQueries({ queryKey: ['loans', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['projects', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['protocol-config', { cluster: cluster.id }] })
      await queryClient.invalidateQueries({ queryKey: ['uploaded-programs'] })
      // N new loans move SOL out of the vault, so the dashboard's share-price
      // math is stale until the next poll.
      await queryClient.invalidateQueries({ queryKey: ['vault-balance', { cluster: cluster.id }] })
    },
    onError: (error: Error) => {
      toast.error('Failed to request project', {
        description: error.message,
      })
    },
  })
}
