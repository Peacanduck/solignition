/**
 * Main entry point for the Solignition client
 * Exports all generated code and adds custom helper functions
 */
export * from './generated'

import type { Address, Rpc } from '@solana/kit'
import { 
  SOLIGNITION_PROGRAM_ADDRESS,
  decodeLoan,
  decodeProtocolConfig,
  decodeDepositorRecord,
  LOAN_DISCRIMINATOR,
  PROTOCOL_CONFIG_DISCRIMINATOR,
  DEPOSITOR_RECORD_DISCRIMINATOR,
} from './generated'
import type { Loan, ProtocolConfig, DepositorRecord } from './generated'

// Type aliases for convenience
export type LoanAccount = {
  address: Address
  data: Loan
}

export type ProtocolConfigAccount = {
  address: Address
  data: ProtocolConfig
}

export type DepositorRecordAccount = {
  address: Address
  data: DepositorRecord
}

/**
 * Fetch all Loan accounts from the program
 */
export async function getAllLoans(
  rpc: Rpc
): Promise<LoanAccount[]> {
  const accounts = await rpc.getProgramAccounts(SOLIGNITION_PROGRAM_ADDRESS, {
    encoding: 'base64',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: LOAN_DISCRIMINATOR,
          encoding: 'base58'
        }
      }
    ]
  }).send()

  return accounts.map(({ account, pubkey }) => ({
    address: pubkey,
    data: decodeLoan({
      address: pubkey,
      data: account.data,
    }).data
  }))
}

/**
 * Fetch the protocol config account
 */
export async function getProtocolConfig(
  rpc: Rpc
): Promise<ProtocolConfigAccount | null> {
  const accounts = await rpc.getProgramAccounts(SOLIGNITION_PROGRAM_ADDRESS, {
    encoding: 'base64',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: PROTOCOL_CONFIG_DISCRIMINATOR,
          encoding: 'base58'
        }
      }
    ]
  }).send()

  if (accounts.length === 0) return null

  const { account, pubkey } = accounts[0]
  return {
    address: pubkey,
    data: decodeProtocolConfig({
      address: pubkey,
      data: account.data,
    }).data
  }
}

/**
 * Fetch all depositor records
 */
export async function getAllDepositorRecords(
  rpc: Rpc
): Promise<DepositorRecordAccount[]> {
  const accounts = await rpc.getProgramAccounts(SOLIGNITION_PROGRAM_ADDRESS, {
    encoding: 'base64',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: DEPOSITOR_RECORD_DISCRIMINATOR,
          encoding: 'base58'
        }
      }
    ]
  }).send()

  return accounts.map(({ account, pubkey }) => ({
    address: pubkey,
    data: decodeDepositorRecord({
      address: pubkey,
      data: account.data,
    }).data
  }))
}

/**
 * Fetch depositor record for a specific owner
 */
export async function getDepositorRecordByOwner(
  rpc: Rpc,
  owner: Address
): Promise<DepositorRecordAccount | null> {
  // Get depositor PDA
  const depositorRecordAddress = await rpc.getProgramDerivedAddress({
    programAddress: SOLIGNITION_PROGRAM_ADDRESS,
    seeds: [
      new Uint8Array([100, 101, 112, 111, 115, 105, 116, 111, 114]), // "depositor"
      owner
    ]
  })

  try {
    const account = await rpc.getAccountInfo(depositorRecordAddress).send()
    
    if (!account?.value) return null

    return {
      address: depositorRecordAddress,
      data: decodeDepositorRecord({
        address: depositorRecordAddress,
        data: account.value.data,
      }).data
    }
  } catch {
    return null
  }
}

/**
 * Fetch loans by borrower
 */
export async function getLoansByBorrower(
  rpc: Rpc,
  borrower: Address
): Promise<LoanAccount[]> {
  const allLoans = await getAllLoans(rpc)
  return allLoans.filter(loan => loan.data.borrower === borrower)
}

/**
 * Fetch active loans
 */
export async function getActiveLoans(
  rpc: Rpc
): Promise<LoanAccount[]> {
  const allLoans = await getAllLoans(rpc)
  return allLoans.filter(loan => loan.data.state === 0) // LoanState.Active = 0
}