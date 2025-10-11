import { useSolana } from '@/components/solana/use-solana'
import { useQuery } from '@tanstack/react-query'
import { getSolignitionProgramAccounts } from '@project/anchor'
import { useSolignitionAccountsQueryKey } from './use-solignition-accounts-query-key'

export function useSolignitionAccountsQuery() {
  const { client } = useSolana()

  return useQuery({
    queryKey: useSolignitionAccountsQueryKey(),
    queryFn: async () => await getSolignitionProgramAccounts(client.rpc),
  })
}
