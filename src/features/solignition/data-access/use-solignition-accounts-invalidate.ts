import { useQueryClient } from '@tanstack/react-query'
import { useSolignitionAccountsQueryKey } from './use-solignition-accounts-query-key'

export function useSolignitionAccountsInvalidate() {
  const queryClient = useQueryClient()
  const queryKey = useSolignitionAccountsQueryKey()

  return () => queryClient.invalidateQueries({ queryKey })
}
