import { SolignitionAccount } from '@project/anchor'
import { UiWalletAccount } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'

import { useSolignitionDecrementMutation } from '../data-access/use-solignition-decrement-mutation'

export function SolignitionUiButtonDecrement({ account, solignition }: { account: UiWalletAccount; solignition: SolignitionAccount }) {
  const decrementMutation = useSolignitionDecrementMutation({ account, solignition })

  return (
    <Button variant="outline" onClick={() => decrementMutation.mutateAsync()} disabled={decrementMutation.isPending}>
      Decrement
    </Button>
  )
}
