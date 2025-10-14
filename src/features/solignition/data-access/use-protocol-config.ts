import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/solana/use-solana'
import { fetchProtocolConfig, SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { getProgramDerivedAddress } from '@solana/kit'

export function useProtocolConfig() {
  const { client, cluster } = useSolana()

  return useQuery({
    queryKey: ['protocol-config', { cluster: cluster.id }],
    queryFn: async () => {
      // Derive the protocol config PDA
      const [configAddress] = await getProgramDerivedAddress({
        programAddress: SOLIGNITION_PROGRAM_ADDRESS,
        seeds: [new TextEncoder().encode('config')],
      })

      try {
        const config = await fetchProtocolConfig(client.rpc, configAddress)
        return {
          address: configAddress,
          data: config.data,
        }
      } catch (error) {
        console.error('Failed to fetch protocol config:', error)
        return null
      }
    },
    retry: false,
  })
}