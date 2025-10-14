import { useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useRequestLoanMutation } from '../data-access/use-request-loan-mutation'
import { useProtocolConfig } from '../data-access/use-protocol-config'

export function RequestLoanPanel({ account }: { account: UiWalletAccount }) {
  const [principal, setPrincipal] = useState('')
  const [durationDays, setDurationDays] = useState('30')
  const [interestRate, setInterestRate] = useState('5')

  const configQuery = useProtocolConfig()
  const requestLoanMutation = useRequestLoanMutation({ account })

  const handleRequestLoan = async () => {
    const principalAmount = parseFloat(principal)
    const days = parseInt(durationDays)
    const rate = parseFloat(interestRate)

    if (isNaN(principalAmount) || principalAmount <= 0) return
    if (isNaN(days) || days <= 0) return
    if (isNaN(rate) || rate < 0) return

    const durationSeconds = BigInt(days * 24 * 60 * 60)
    const interestRateBps = Math.floor(rate * 100)
    const adminFeeBps = configQuery.data?.data.defaultAdminFeeBps ?? 100

    await requestLoanMutation.mutateAsync({
      principal: BigInt(Math.floor(principalAmount * 1_000_000_000)),
      duration: durationSeconds,
      interestRateBps,
      adminFeeBps,
    })

    // Reset form
    setPrincipal('')
    setDurationDays('30')
    setInterestRate('5')
  }

  const calculateTotalRepayment = () => {
    const principalAmount = parseFloat(principal)
    const rate = parseFloat(interestRate)

    if (isNaN(principalAmount) || isNaN(rate)) return null

    const interest = (principalAmount * rate) / 100
    return (principalAmount + interest).toFixed(2)
  }

  const totalRepayment = calculateTotalRepayment()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a Loan</CardTitle>
        <CardDescription>Borrow SOL for program deployment. Repay with interest.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="principal">Loan Amount (SOL)</Label>
          <Input
            id="principal"
            type="number"
            step="0.1"
            min="0"
            placeholder="5.0"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            disabled={requestLoanMutation.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (days)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              placeholder="30"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              disabled={requestLoanMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interest">Interest Rate (%)</Label>
            <Input
              id="interest"
              type="number"
              step="0.1"
              min="0"
              placeholder="5.0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              disabled={requestLoanMutation.isPending}
            />
          </div>
        </div>

        {totalRepayment && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Total Repayment Amount</p>
            <p className="text-2xl font-bold">{totalRepayment} SOL</p>
            <p className="text-xs text-muted-foreground mt-1">
              Principal: {principal} SOL + Interest: {(parseFloat(totalRepayment) - parseFloat(principal)).toFixed(2)}{' '}
              SOL
            </p>
          </div>
        )}

        <Button
          onClick={handleRequestLoan}
          disabled={requestLoanMutation.isPending || !principal || !durationDays || !interestRate}
          className="w-full"
        >
          {requestLoanMutation.isPending ? 'Requesting Loan...' : 'Request Loan'}
        </Button>

        {configQuery.data && (
          <p className="text-xs text-muted-foreground">
            Default admin fee: {(configQuery.data.data.defaultAdminFeeBps / 100).toFixed(1)}%
          </p>
        )}
      </CardContent>
    </Card>
  )
}