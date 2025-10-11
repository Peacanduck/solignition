import { useSolana } from '@/components/solana/use-solana'

export function useSolignitionAccountsQueryKey() {
  const { cluster } = useSolana()

  return ['solignition', 'accounts', { cluster }]
}
