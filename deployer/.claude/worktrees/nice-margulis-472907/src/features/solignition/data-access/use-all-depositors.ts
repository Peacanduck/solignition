import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/solana/use-solana'
import type { Address } from '@solana/kit'
import type { DepositorRecord } from '@project/anchor'
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, BN, Idl as IDL, Program, setProvider } from '@coral-xyz/anchor'
import idl from '../../../../anchor/target/idl/solignition.json'
import type { Solignition } from '../../../../anchor/target/types/solignition.ts'

export type DepositorAccount = {
  address: Address
  data: DepositorRecord
}

function getRpcUrl(clusterId: string): string {
  switch (clusterId) {
    case 'solana:mainnet-beta':
      return clusterApiUrl('mainnet-beta')
    case 'solana:devnet':
      return clusterApiUrl('devnet')
    case 'solana:testnet':
      return clusterApiUrl('testnet')
    case 'solana:localnet':
      return 'http://127.0.0.1:8899'
    default:
      return 'http://127.0.0.1:8899'
  }
}

function bnToBigInt(v: any): bigint {
  if (!v) return 0n
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(v)
  if (typeof v === 'string') return BigInt(v)
  if (v instanceof BN || v._bn) return BigInt(v.toString())
  return 0n
}

function publicKeyToString(pubkey: any): string {
  if (typeof pubkey === 'string') return pubkey
  if (pubkey?.toString) return pubkey.toString()
  if (pubkey?._bn) return new PublicKey(pubkey).toString()
  return pubkey
}

function normalizeDepositorData(raw: any): DepositorRecord {
  return {
    ...raw,
    owner: publicKeyToString(raw.owner),
    depositedAmount: bnToBigInt(raw.depositedAmount),
    shareAmount: bnToBigInt(raw.shareAmount),
    lastUpdateTs: bnToBigInt(raw.lastUpdateTs),
  } as DepositorRecord
}

export function useAllDepositors() {
  const { cluster } = useSolana()

  return useQuery({
    queryKey: ['all-depositors', { cluster: cluster.id }],
    queryFn: async () => {
      const connection = new Connection(getRpcUrl(cluster.id), 'confirmed')
      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
      }
      const provider = new AnchorProvider(connection, dummyWallet as any, {
        commitment: 'confirmed',
      })
      setProvider(provider)
      const program = new Program(idl as IDL, provider) as Program<Solignition>

      const all = await (program.account as any).depositorRecord.all()
      const depositors: DepositorAccount[] = all.map((info: any) => ({
        address: info.publicKey.toString() as Address,
        data: normalizeDepositorData(info.account),
      }))

      return depositors
    },
    retry: 1,
    refetchInterval: 30000,
  })
}
