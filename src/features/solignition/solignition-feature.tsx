import { useSolana } from '@/components/solana/use-solana'
import { WalletDropdown } from '@/components/wallet-dropdown'
import { AppHero } from '@/components/app-hero'
import { SolignitionUiButtonInitialize } from './ui/solignition-ui-button-initialize'
import { SolignitionUiList } from './ui/solignition-ui-list'
import { SolignitionUiProgramExplorerLink } from './ui/solignition-ui-program-explorer-link'
import { SolignitionUiProgramGuard } from './ui/solignition-ui-program-guard'

export default function SolignitionFeature() {
  const { account } = useSolana()

  return (
    <SolignitionUiProgramGuard>
      <AppHero
        title="Solignition"
        subtitle={
          account
            ? "Initialize a new solignition onchain by clicking the button. Use the program's methods (increment, decrement, set, and close) to change the state of the account."
            : 'Select a wallet to run the program.'
        }
      >
        <p className="mb-6">
          <SolignitionUiProgramExplorerLink />
        </p>
        {account ? (
          <SolignitionUiButtonInitialize account={account} />
        ) : (
          <div style={{ display: 'inline-block' }}>
            <WalletDropdown />
          </div>
        )}
      </AppHero>
      {account ? <SolignitionUiList account={account} /> : null}
    </SolignitionUiProgramGuard>
  )
}
