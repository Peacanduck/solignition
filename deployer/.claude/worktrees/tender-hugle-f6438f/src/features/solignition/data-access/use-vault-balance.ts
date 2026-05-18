import { useQuery } from '@tanstack/react-query'
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
}