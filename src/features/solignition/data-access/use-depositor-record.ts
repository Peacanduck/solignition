import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/solana/use-solana'
import { SOLIGNITION_PROGRAM_ADDRESS, fetchDepositorRecord } from '@project/anchor'
import { getAddressEncoder, getProgramDerivedAddress } from '@solana/kit'
import type { Address } from '@solana/kit'

export function useDepositorRecord(owner?: Address) {
  const { client, cluster } = useSolana()

  return useQuery({
    queryKey: ['depositor-record', { cluster: cluster.id, owner }],
    queryFn: async () => {
      if (!owner) return null

      // Derive depositor PDA
      const [depositorRecordAddress] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [
                new TextEncoder().encode('depositor'),
                 getAddressEncoder().encode(owner)
               ]
      })

      try {
        const record = await fetchDepositorRecord(client.rpc, depositorRecordAddress)
        return {
          address: depositorRecordAddress,
          data: record.data,
        }
      } catch (error) {
        // Account doesn't exist yet
        console.log('Depositor record not found:', error);
        return null;
      }
    },
    enabled: !!owner,
    refetchInterval: 5000, // Refetch every 5 seconds to catch updates
  })
}