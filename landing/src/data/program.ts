// Read-only Solignition Anchor program client.
//
// This file mirrors the wallet-free pattern from
// `src/features/solignition/data-access/use-loans.ts` (lines 262–275): a dummy
// wallet wrapped in an AnchorProvider lets us call `program.account.X.all()`
// and `getAccountInfo` without ever touching wallet-adapter. The landing page
// is intentionally wallet-free, so we instantiate this once at module scope
// and share it across the page.

import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import idl from '../../../anchor/target/idl/solignition.json'
import type { Solignition } from '../../../anchor/target/types/solignition'

const RPC_URL: string =
  (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined) ??
  clusterApiUrl('devnet')

export const connection = new Connection(RPC_URL, 'confirmed')

const dummyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async <T,>(tx: T): Promise<T> => tx,
  signAllTransactions: async <T,>(txs: T[]): Promise<T[]> => txs,
}

const provider = new AnchorProvider(connection, dummyWallet as never, {
  commitment: 'confirmed',
})

export const program = new Program(idl as Idl, provider) as unknown as Program<Solignition>
export const programId: PublicKey = program.programId

export function getVaultPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault')],
    programId,
  )
  return pda
}

export function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('config')],
    programId,
  )
  return pda
}
