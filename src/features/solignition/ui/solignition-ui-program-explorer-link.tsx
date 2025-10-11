import { SOLIGNITION_PROGRAM_ADDRESS } from '@project/anchor'
import { AppExplorerLink } from '@/components/app-explorer-link'
import { ellipsify } from '@wallet-ui/react'

export function SolignitionUiProgramExplorerLink() {
  return <AppExplorerLink address={SOLIGNITION_PROGRAM_ADDRESS} label={ellipsify(SOLIGNITION_PROGRAM_ADDRESS)} />
}
