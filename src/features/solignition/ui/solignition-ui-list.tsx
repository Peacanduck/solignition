import { SolignitionUiCard } from './solignition-ui-card'
import { useSolignitionAccountsQuery } from '@/features/solignition/data-access/use-solignition-accounts-query'
import { UiWalletAccount } from '@wallet-ui/react'

export function SolignitionUiList({ account }: { account: UiWalletAccount }) {
  const solignitionAccountsQuery = useSolignitionAccountsQuery()

  if (solignitionAccountsQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }

  if (!solignitionAccountsQuery.data?.length) {
    return (
      <div className="text-center">
        <h2 className={'text-2xl'}>No accounts</h2>
        No accounts found. Initialize one to get started.
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {solignitionAccountsQuery.data?.map((solignition) => (
        <SolignitionUiCard account={account} key={solignition.address} solignition={solignition} />
      ))}
    </div>
  )
}
