import { SolignitionAccount } from '@project/anchor'
import { UiWalletAccount } from '@wallet-ui/react'
import { Button } from '@/components/ui/button'

import { useSolignitionCloseMutation } from '@/features/solignition/data-access/use-solignition-close-mutation'

export function SolignitionUiButtonClose({ account, solignition }: { account: UiWalletAccount; solignition: SolignitionAccount }) {
  const closeMutation = useSolignitionCloseMutation({ account, solignition })

  return (
    <Button
      variant="destructive"
      onClick={() => {
        if (!window.confirm('Are you sure you want to close this account?')) {
          return
        }
        return closeMutation.mutateAsync()
      }}
      disabled={closeMutation.isPending}
    >
      Close
    </Button>
  )
}
