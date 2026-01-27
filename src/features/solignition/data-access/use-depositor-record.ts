import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import { useSolignitionProgram } from './use-program'

export function useDepositorRecord(owner?: string) {
  const { cluster } = useSolana()
  const { program } = useSolignitionProgram()

  return useQuery({
    queryKey: ['depositor-record', { cluster: cluster.id, owner }],
    queryFn: async () => {
      if (!owner) return null

      const ownerPubkey = new PublicKey(owner)

      const [depositorRecordAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('depositor'), ownerPubkey.toBuffer()],
        program.programId
      )

      try {
        const record = await program.account.depositorRecord.fetch(depositorRecordAddress)
        

        return {
          address: depositorRecordAddress.toString(),
          data: {
            ...record,
            depositedAmount: BigInt(record.depositedAmount.toString()),
            shareAmount: BigInt(record.shareAmount.toString()),
            lastDepositTs: BigInt(record.lastUpdateTs.toString()),
          },
        }
       /* return {
          address: depositorRecordAddress.toString(),
          data: record,
        }*/
      } catch (error) {
        console.log('Depositor record not found:', error)
        return null
      }
    },
    enabled: !!owner,
    refetchInterval: 5000,
  })
}

/*import { useQuery } from '@tanstack/react-query'
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
}*/