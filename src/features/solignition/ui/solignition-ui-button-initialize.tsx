import { Button } from '@/components/ui/button'
import { UiWalletAccount } from '@wallet-ui/react'

import { useSolignitionInitializeMutation } from '@/features/solignition/data-access/use-solignition-initialize-mutation'

export function SolignitionUiButtonInitialize({ account }: { account: UiWalletAccount }) {
  const mutationInitialize = useSolignitionInitializeMutation({ account })

  return (
    <Button onClick={() => mutationInitialize.mutateAsync()} disabled={mutationInitialize.isPending}>
      Initialize Solignition {mutationInitialize.isPending && '...'}
    </Button>
  )
}
