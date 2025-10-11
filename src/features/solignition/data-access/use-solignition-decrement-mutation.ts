import { SolignitionAccount, getDecrementInstruction } from '@project/anchor'
import { useMutation } from '@tanstack/react-query'
import { UiWalletAccount, useWalletUiSigner } from '@wallet-ui/react'
import { useWalletUiSignAndSend } from '@wallet-ui/react-gill'
import { toastTx } from '@/components/toast-tx'
import { useSolignitionAccountsInvalidate } from './use-solignition-accounts-invalidate'

export function useSolignitionDecrementMutation({
  account,
  solignition,
}: {
  account: UiWalletAccount
  solignition: SolignitionAccount
}) {
  const invalidateAccounts = useSolignitionAccountsInvalidate()
  const signer = useWalletUiSigner({ account })
  const signAndSend = useWalletUiSignAndSend()

  return useMutation({
    mutationFn: async () => await signAndSend(getDecrementInstruction({ solignition: solignition.address }), signer),
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
  })
}
