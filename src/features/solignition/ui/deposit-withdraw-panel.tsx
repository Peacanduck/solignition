import { useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDepositorRecord } from '../data-access/use-depositor-record'
import { useDepositMutation } from '../data-access/use-deposit-mutation'
import { useWithdrawMutation } from '../data-access/use-withdraw-mutation'

export function DepositWithdrawPanel({ account }: { account: UiWalletAccount }) {
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const depositorQuery = useDepositorRecord(account.address)
  const depositMutation = useDepositMutation({ account })
  const withdrawMutation = useWithdrawMutation({ account })

  const formatSOL = (lamports: bigint) => {
    return (Number(lamports) / 1_000_000_000).toFixed(4)
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) return

    await depositMutation.mutateAsync(BigInt(Math.floor(amount * 1_000_000_000)))
    setDepositAmount('')
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) return

    await withdrawMutation.mutateAsync(BigInt(Math.floor(amount * 1_000_000_000)))
    setWithdrawAmount('')
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Current Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Balance</CardTitle>
          <CardDescription>Your current deposited balance in the protocol</CardDescription>
        </CardHeader>
        <CardContent>
          {depositorQuery.isLoading ? (
            <div className="h-12 bg-muted animate-pulse rounded" />
          ) : depositorQuery.data ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Deposited Amount</p>
                <p className="text-2xl font-bold">{formatSOL(depositorQuery.data.data.depositedAmount)} SOL</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Share Amount</p>
                <p className="text-lg">{depositorQuery.data.data.shareAmount.toString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No deposits yet</p>
          )}
        </CardContent>
      </Card>

      {/* Deposit/Withdraw Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Funds</CardTitle>
          <CardDescription>Deposit or withdraw SOL from the protocol</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deposit */}
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">Deposit Amount (SOL)</Label>
            <div className="flex gap-2">
              <Input
                id="deposit-amount"
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                disabled={depositMutation.isPending}
              />
              <Button onClick={handleDeposit} disabled={depositMutation.isPending || !depositAmount}>
                {depositMutation.isPending ? 'Depositing...' : 'Deposit'}
              </Button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Withdraw Amount (SOL)</Label>
            <div className="flex gap-2">
              <Input
                id="withdraw-amount"
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled={withdrawMutation.isPending || !depositorQuery.data}
              />
              <Button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending || !withdrawAmount || !depositorQuery.data}
                variant="outline"
              >
                {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw'}
              </Button>
            </div>
            {!depositorQuery.data && (
              <p className="text-sm text-muted-foreground">Deposit funds first to enable withdrawals</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}