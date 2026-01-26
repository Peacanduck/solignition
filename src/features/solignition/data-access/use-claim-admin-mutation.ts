import { useMutation } from '@tanstack/react-query'
import { UiWalletAccount } from '@wallet-ui/react'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionProgram } from './use-program'


export function useClaimAdminMutation({ account }: { account: UiWalletAccount }) {
  const { program } = useSolignitionProgram()

  return useMutation({
    mutationFn: async () => {
      const adminPubkey = new PublicKey(account.address)

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
        .claimAdmin()
        .accounts({
          admin: adminPubkey,
          adminPda,
          protocolConfig,
          treasury,
          systemProgram: SystemProgram.programId,
          eventAuthority,
          program: program.programId,
        })
        .rpc()

      return tx
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Admin funds claimed successfully')
    },
  })
}


/*import { useMutation } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { getClaimAdminInstructionAsync, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
//import { SystemProgram} from "@solana/web3.js";
import { toastTx } from '@/components/toast-tx'
import { toast } from 'sonner'
//import { useSolana } from '@/components/solana/use-solana'
import { getProgramDerivedAddress } from '@solana/kit'
//import { useProtocolConfig } from './use-protocol-config';

export function useClaimAdminMutation({ account }: { account: UiWalletAccount }) {
  //const { cluster } = useSolana()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()
  //const protocolConfigQuery = useProtocolConfig()

  return useMutation({
    mutationFn: async () => {

      // Derive protocol config PDA
            const [protocolConfig] = await getProgramDerivedAddress({
              programAddress: SOLIGNITION_PROGRAM_ADDRESS,
              seeds: [new TextEncoder().encode('config')],
            })          
          
   
      // Derive treasury PDA
      const [treasuryPda] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('treasury')],
      })
    
      const instruction = await getClaimAdminInstructionAsync({
        admin: signer,
        program: SOLIGNITION_PROGRAM_ADDRESS,
        protocolConfig,
        treasury: treasuryPda,
        
        // Optional parameters will be derived automatically:
        // - adminPda (derived from 'admin' seed)
        // - protocolConfig (derived from 'config' seed)
        // - systemProgram (defaults to '11111111111111111111111111111111')
      })
      try {
        return await signAndSend(instruction, signer)
      } catch (error) {
        console.error('Error in claim admin mutation:', error)
        throw error
      }
      
    },
    onSuccess: async (signature) => {
      toastTx(signature, 'Yield claimed successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to request loan', {
        description: error.message,
      })
    }
  })
}*/