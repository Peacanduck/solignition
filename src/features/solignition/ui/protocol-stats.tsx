import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useLoans } from '../data-access/use-loans'

export function ProtocolStats() {
  const configQuery = useProtocolConfig()
  const loansQuery = useLoans()

  if (configQuery.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!configQuery.data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Protocol not initialized</p>
        </CardContent>
      </Card>
    )
  }

  const config = configQuery.data.data
  const activeLoans = loansQuery.data?.filter(loan => loan.data.state === 0).length ?? 0

  const formatSOL = (lamports: bigint) => {
    return (Number(lamports) / 1_000_000_000).toFixed(2)
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatSOL(config.totalDeposits)} SOL</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Loans Outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatSOL(config.totalLoansOutstanding)} SOL</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeLoans}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{config.loanCounter.toString()}</div>
        </CardContent>
      </Card>
    </div>
  )
}