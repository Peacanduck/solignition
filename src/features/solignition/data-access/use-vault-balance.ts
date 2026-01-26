// src/features/solignition/data-access/use-vault-balance.ts
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import { useSolignitionProgram } from './use-program'

export function useVaultBalance() {
  const { cluster } = useSolana()
  const { program } = useSolignitionProgram()

  return useQuery({
    queryKey: ['vault-balance', { cluster: cluster.id }],
    queryFn: async () => {
      const [vaultAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        program.programId
      )

      try {
        const balance = await program.provider.connection.getBalance(vaultAddress)
        return BigInt(balance)
      } catch (error) {
        console.error('Failed to fetch vault balance:', error)
        return 0n
      }
    },
    refetchInterval: 15000,
  })
}

/*import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/solana/use-solana'
import { SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'

export function useVaultBalance() {
  const { client, cluster } = useSolana()

  return useQuery({
    queryKey: ['vault-balance', { cluster: cluster.id }],
    queryFn: async () => {
      // Derive the vault PDA
      const [vaultAddress] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('vault')],
      })

      try {
        // Fetch the account info to get the lamports balance
        const accountInfo = await client.rpc.getAccountInfo(vaultAddress, {
          encoding: 'base64'
        }).send()

        if (!accountInfo.value) {
          return 0n
        }

        return accountInfo.value.lamports
      } catch (error) {
        console.error('Failed to fetch vault balance:', error)
        return 0n
      }
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  })
}*/