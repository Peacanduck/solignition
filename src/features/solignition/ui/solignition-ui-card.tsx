import { SolignitionAccount } from '@project/anchor'
import { ellipsify, UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppExplorerLink } from '@/components/app-explorer-link'
import { SolignitionUiButtonClose } from './solignition-ui-button-close'
import { SolignitionUiButtonDecrement } from './solignition-ui-button-decrement'
import { SolignitionUiButtonIncrement } from './solignition-ui-button-increment'
import { SolignitionUiButtonSet } from './solignition-ui-button-set'

export function SolignitionUiCard({ account, solignition }: { account: UiWalletAccount; solignition: SolignitionAccount }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Solignition: {solignition.data.count}</CardTitle>
        <CardDescription>
          Account: <AppExplorerLink address={solignition.address} label={ellipsify(solignition.address)} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 justify-evenly">
          <SolignitionUiButtonIncrement account={account} solignition={solignition} />
          <SolignitionUiButtonSet account={account} solignition={solignition} />
          <SolignitionUiButtonDecrement account={account} solignition={solignition} />
          <SolignitionUiButtonClose account={account} solignition={solignition} />
        </div>
      </CardContent>
    </Card>
  )
}
