import { SolignitionAccount, getIncrementInstruction } from '@project/anchor'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { useMutation } from '@tanstack/react-query'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionAccountsInvalidate } from './use-solignition-accounts-invalidate'

export function useSolignitionIncrementMutation({
  account,
  solignition,
}: {
  account: UiWalletAccount
  solignition: SolignitionAccount
}) {
  const invalidateAccounts = useSolignitionAccountsInvalidate()
  const signAndSend = useWalletUiSignAndSend()
  const signer = useWalletUiSigner({ account })

  return useMutation({
    mutationFn: async () => await signAndSend(getIncrementInstruction({ solignition: solignition.address }), signer),
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}
