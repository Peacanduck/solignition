import { useSolana } from '@/components/solana/use-solana'
import { WalletDropdown } from '@/components/wallet-dropdown'
import { AppHero } from '@/components/app-hero'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DepositWithdrawPanel } from './ui/deposit-withdraw-panel'
import { RequestLoanPanel } from './ui/request-loan-panel'
import { LoansDisplay } from './ui/loans-display'
import { ProtocolStats } from './ui/protocol-stats'

export default function SolignitionFeature() {
  const { account } = useSolana()

  return (
    <div className="space-y-8">
      <AppHero
        title="Solignition Lending Protocol"
        subtitle={
          account
            ? 'Deposit SOL to earn yield, or request loans for program deployment.'
            : 'Connect your wallet to get started.'
        }
      />

      {account ? (
        <div className="space-y-6">
          <ProtocolStats />

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit">Deposit/Withdraw</TabsTrigger>
              <TabsTrigger value="borrow">Borrow</TabsTrigger>
              <TabsTrigger value="loans">My Loans</TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="space-y-4">
              <DepositWithdrawPanel account={account} />
            </TabsContent>

            <TabsContent value="borrow" className="space-y-4">
              <RequestLoanPanel account={account} />
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              <LoansDisplay account={account} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex justify-center py-12">
          <WalletDropdown />
        </div>
      )}
    </div>
  )
}