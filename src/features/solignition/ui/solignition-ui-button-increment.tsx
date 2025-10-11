import { SolignitionAccount } from '@project/anchor'
import { UiWalletAccount } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'
import { useSolignitionIncrementMutation } from '../data-access/use-solignition-increment-mutation'

export function SolignitionUiButtonIncrement({ account, solignition }: { account: UiWalletAccount; solignition: SolignitionAccount }) {
  const incrementMutation = useSolignitionIncrementMutation({ account, solignition })

  return (
    <Button variant="outline" onClick={() => incrementMutation.mutateAsync()} disabled={incrementMutation.isPending}>
      Increment
    </Button>
  )
}
