import { SolignitionAccount } from '@project/anchor'
import { UiWalletAccount } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'

import { useSolignitionSetMutation } from '@/features/solignition/data-access/use-solignition-set-mutation'

export function SolignitionUiButtonSet({ account, solignition }: { account: UiWalletAccount; solignition: SolignitionAccount }) {
  const setMutation = useSolignitionSetMutation({ account, solignition })

  return (
    <Button
      variant="outline"
      onClick={() => {
        const value = window.prompt('Set value to:', solignition.data.count.toString() ?? '0')
        if (!value || parseInt(value) === solignition.data.count || isNaN(parseInt(value))) {
          return
        }
        return setMutation.mutateAsync(parseInt(value))
      }}
      disabled={setMutation.isPending}
    >
      Set
    </Button>
  )
}
