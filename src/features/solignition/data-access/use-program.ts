import { useMemo } from 'react'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'
import { useSolana } from '@/components/solana/use-solana'
import type { Solignition } from '../../../../anchor/target/types/solignition'
import idl from '../../../../anchor/target/idl/solignition.json'

const PROGRAM_ID = new PublicKey('Dz4Zey62uraTxX9V9HBXpCfuFtNzdt5ULNQ1yZXh6Peh')

function getRpcUrl(clusterId: string): string {
  switch (clusterId) {
    case 'solana:mainnet-beta':
      return 'https://api.mainnet-beta.solana.com'
    case 'solana:devnet':
      return 'https://api.devnet.solana.com'
    case 'solana:testnet':
      return 'https://api.testnet.solana.com'
    case 'solana:localnet':
      return 'http://127.0.0.1:8899'
    default:
      return 'http://127.0.0.1:8899'
  }
}

export function useSolignitionProgram() {
  const { cluster } = useSolana()

  const program = useMemo(() => {
    const connection = new Connection(getRpcUrl(cluster.id), 'confirmed')
    
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    }
    
    const provider = new AnchorProvider(connection, dummyWallet as any, {
      commitment: 'confirmed'
    })

    return new Program<Solignition>(idl as Solignition, provider)
  }, [cluster.id])

  return { program, programId: PROGRAM_ID }
}