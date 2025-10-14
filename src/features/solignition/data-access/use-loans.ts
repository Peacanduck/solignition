import { useQuery } from '@tanstack/react-query'
import { useSolana } from '@/components/solana/use-solana'
import { SOLIGNITION_PROGRAM_ADDRESS, decodeLoan, LOAN_DISCRIMINATOR } from '@project/anchor'
import type { Address } from '@solana/kit'
import type { Loan } from '@project/anchor'

export type LoanAccount = {
  address: Address
  data: Loan
}

export function useLoans() {
  const { client, cluster } = useSolana()

  return useQuery({
    queryKey: ['loans', { cluster: cluster.id }],
    queryFn: async () => {
      const accounts = await client.rpc.getProgramAccounts(
        SOLIGNITION_PROGRAM_ADDRESS,
        {
          encoding: 'base64',
          filters: [
            {
              memcmp: {
                offset: 0,
                bytes: LOAN_DISCRIMINATOR,
                encoding: 'base58',
              },
            },
          ],
        }
      ).send()

      return accounts.map(({ account, pubkey }) => ({
        address: pubkey,
        data: decodeLoan({
          address: pubkey,
          data: account.data,
        }).data,
      })) as LoanAccount[]
    },
  })
}

export function useLoansByBorrower(borrower?: Address) {
  const loansQuery = useLoans()

  return {
    ...loansQuery,
    data: loansQuery.data?.filter(loan => loan.data.borrower === borrower),
  }
}

export function useActiveLoans() {
  const loansQuery = useLoans()

  return {
    ...loansQuery,
    data: loansQuery.data?.filter(loan => loan.data.state === 0), // LoanState.Active
  }
}