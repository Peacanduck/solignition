// Here we export some useful types and functions for interacting with the Anchor program.
import { Account, getBase58Decoder, SolanaClient } from 'gill'
import { getProgramAccountsDecoded } from './helpers/get-program-accounts-decoded'
import { Solignition, SOLIGNITION_DISCRIMINATOR, SOLIGNITION_PROGRAM_ADDRESS, getSolignitionDecoder } from './client/js'
import SolignitionIDL from '../target/idl/solignition.json'

export type SolignitionAccount = Account<Solignition, string>

// Re-export the generated IDL and type
export { SolignitionIDL }

export * from './client/js'

export function getSolignitionProgramAccounts(rpc: SolanaClient['rpc']) {
  return getProgramAccountsDecoded(rpc, {
    decoder: getSolignitionDecoder(),
    filter: getBase58Decoder().decode(SOLIGNITION_DISCRIMINATOR),
    programAddress: SOLIGNITION_PROGRAM_ADDRESS,
  })
}
