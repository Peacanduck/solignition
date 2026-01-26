import { useMemo, useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
//import { PublicKey } from "@solana/web3.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wallet, Info, Coins, Percent } from 'lucide-react'
import { useDepositorRecord } from '../data-access/use-depositor-record'
import { useDepositMutation } from '../data-access/use-deposit-mutation'
import { useWithdrawMutation } from '../data-access/use-withdraw-mutation'
//import { useClaimYieldMutation } from '../data-access/use-claim-yield-mutation'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useVaultBalance } from '../data-access/use-vault-balance'
import { address } from '@solana/kit';


// Updated to send SHARES to backend instead of SOL amounts
// - Deposit: converts SOL input → shares → sends shares to backend
// - Withdraw: calculates shares needed → sends shares to backend

const SHARE_DECIMALS = 1_000_000_000n // 1e9 precision

function formatSOL(lamports: bigint, precision = 6) {
  const sign = lamports < 0n ? '-' : ''
  const abs = lamports < 0n ? -lamports : lamports
  const whole = abs / 1_000_000_000n
  const rem = abs % 1_000_000_000n
  const scale = 10n ** BigInt(precision)
  const scaled = (rem * scale) / 1_000_000_000n

  const decimals = scaled.toString().padStart(precision, '0')
  return `${sign}${whole.toString()}.${decimals}`
}
/* 
function safeDiv(n: bigint, d: bigint) {
  if (d === 0n) return 0n
  return n / d
}*/

export function DepositWithdrawPanel({ account }: { account: UiWalletAccount }) {
  // data hooks
  const depositorQuery = useDepositorRecord(address(account.address))
  const configQuery = useProtocolConfig()
  const vaultBalanceQuery = useVaultBalance()

  const depositMutation = useDepositMutation({ account })
  const withdrawMutation = useWithdrawMutation({ account })
  //const claimYieldMutation = useClaimYieldMutation({ account })

  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawMode, setWithdrawMode] = useState<'interest' | 'custom' | 'percent'>('custom')
  const [customWithdrawAmount, setCustomWithdrawAmount] = useState('')
  const [withdrawPercent, setWithdrawPercent] = useState(25)

  const loading = depositorQuery.isLoading || configQuery.isLoading || vaultBalanceQuery.isLoading
  const vaultBalance = vaultBalanceQuery.data ?? 0n
  const totalShares:bigint = configQuery.data?.data.totalShares ?? 0n

  const calculateSharePrice = useMemo(() => {
    console.log('config:', configQuery.data?.data);
    if (totalShares === 0n) return 1_000_000_000n
    const totalAssets: bigint = vaultBalance + (configQuery.data?.data.totalLoansOutstanding ?? 0n)
    return (totalAssets * SHARE_DECIMALS) / totalShares
  }, [vaultBalance, totalShares])

  // Convert SOL amount to shares needed
  const sharesForAmount = (amountLamports: bigint) => {
    const price = calculateSharePrice
    if (price === 0n) return 0n
    return (amountLamports * SHARE_DECIMALS) / price
  }

  // Convert shares to SOL amount
  const amountForShares = (shares: bigint) => {
    const price = calculateSharePrice
    return (shares * price) / SHARE_DECIMALS
  }

  // derived data
  const shareAmount = depositorQuery.data?.data.shareAmount ?? 0n
 // const depositedAmount = amountForShares(shareAmount) ?? 0n
 // const totalDeposits = configQuery.data?.data.totalDeposits ?? 0n
  //const totalYieldDistributed = configQuery.data?.data.totalYieldDistributed ?? 0n
  const totalLoansOutstanding = configQuery.data?.data.totalLoansOutstanding ?? 0n
  
  const currentValue = useMemo(() => {
    if (shareAmount === 0n || totalShares === 0n) return 0n
    const price = calculateSharePrice
    return (shareAmount * price) / SHARE_DECIMALS
  }, [shareAmount, totalShares, calculateSharePrice])

  //const earnedInterest = currentValue > depositedAmount ? currentValue - depositedAmount : 0n
  const availableLiquidity = vaultBalance 

  /* Calculate shares needed to withdraw earned interest only
  const sharesForInterest = useMemo(() => {
    if (earnedInterest <= 0n) return 0n
    return sharesForAmount(earnedInterest)
  }, [earnedInterest, calculateSharePrice])*/

  // Validation: check if withdrawal amount is possible
  const canWithdrawAmount = (amountLamports: bigint) => {
    if (amountLamports <= 0n) return false
    if (amountLamports > availableLiquidity) return false
    if (amountLamports > currentValue) return false
    return true
  }

  function solToLamports(sol: string): bigint {
  const [whole, frac = ''] = sol.split('.')
  const padded = (frac + '000000000').slice(0, 9)
  return BigInt(whole || '0') * 1_000_000_000n + BigInt(padded)
}


  // DEPOSIT: User enters SOL → convert to shares → send shares to backend
  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount)
    if (isNaN(amt) || amt <= 0) return
    
    const solLamports = solToLamports(depositAmount);//BigInt(Math.floor(amt * 1_000_000_000))
    //const sharesToMint = sharesForAmount(solLamports)
    
    // Backend expects shares
    await depositMutation.mutateAsync(solLamports)
    setDepositAmount('')
  }

  /* CLAIM YIELD: Calculate shares representing only the interest earned
  const handleClaimYield = async () => {
    if (earnedInterest <= 0n) return
    
    // Backend expects shares to burn
   // await claimYieldMutation.mutateAsync()
  }*/

  // WITHDRAW CUSTOM: User enters SOL > convert to shares > send shares to backend
  const handleWithdrawCustom = async () => {
    const amt = parseFloat(customWithdrawAmount)
    if (isNaN(amt) || amt <= 0) return
    
    const solLamports = solToLamports(customWithdrawAmount);//BigInt(Math.floor(amt * 1_000_000_000))
    if (!canWithdrawAmount(solLamports)) return
    
    const sharesToBurn = sharesForAmount(solLamports)
    
    // Backend expects shares
    await withdrawMutation.mutateAsync(sharesToBurn)
    setCustomWithdrawAmount('')
  }

  // WITHDRAW PERCENT: Calculate shares representing the percentage
  const handleWithdrawPercent = async () => {
    // Calculate shares to burn based on percentage
    const sharesToBurn = (shareAmount * BigInt(withdrawPercent)) / 100n
    const solValue = amountForShares(sharesToBurn)
    
    if (!canWithdrawAmount(solValue)) return
    
    // Backend expects shares
    await withdrawMutation.mutateAsync(sharesToBurn)
  }

  /* WITHDRAW ALL: Send all user's shares
  const handleWithdrawAll = async () => {
    if (!canWithdrawAmount(currentValue)) return
    
    // Backend expects shares - send all of them
    await withdrawMutation.mutateAsync(shareAmount)
  }*/

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="grid gap-6 lg:grid-cols-3 ">
      {/* left: stats */}
      <div className="lg:col-span-2 space-y-6" >
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
         {/* <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Principal</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatSOL(depositedAmount, 6)}</div>
              <div className="text-xs text-muted-foreground">SOL deposited</div>
            </CardContent>
          </Card>*/}

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Current Value</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatSOL(currentValue, 6)}</div>
              <div className="text-xs text-muted-foreground">Includes earned yield</div>
            </CardContent>
          </Card>
         {/* 
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Interest</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-green-600">{formatSOL(earnedInterest, 6)}</div>
              <div className="text-xs text-muted-foreground">
                {earnedInterest > 0n
                  ? `${((Number(earnedInterest) / Number(depositedAmount || 1n)) * 100).toFixed(2)}%`
                  : '0%'}
              </div>
            </CardContent>
          </Card>*/}

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Shares</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{shareAmount.toString()}</div>
              <div className="text-xs text-muted-foreground">@ {String(calculateSharePrice / 1_000_000_000n)} lamport per share</div>
            </CardContent>
          </Card>
        </div>
         {/* Protocol snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Protocol Snapshot</CardTitle>
            <CardDescription>Live protocol metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4  ">
              <div>
                <div className="text-xs text-muted-foreground">Vault Balance</div>
                <div className="font-medium">{formatSOL(vaultBalance, 6)} SOL</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Loans Outstanding</div>
                <div className="font-medium">{formatSOL(totalLoansOutstanding, 6)} SOL</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Available Liquidity</div>
                <div className="font-medium">{formatSOL(availableLiquidity, 6)} SOL</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Shares</div>
                <div className="font-medium">{totalShares.toString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* right: actions */}
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Deposit</CardTitle>
            <CardDescription>Deposit SOL to start earning yield</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label htmlFor="deposit">Amount (SOL)</Label>
                <Input
                  id="deposit"
                  type="number"
                  step="0.01"
                  placeholder="0.0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>

              {depositAmount && (
                <div className="text-xs text-muted-foreground">
                  ≈ {sharesForAmount(BigInt(Math.floor(parseFloat(depositAmount) * 1_000_000_000))).toString()} shares
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleDeposit} disabled={depositMutation.isPending || !depositAmount} className="flex-1">
                  {depositMutation.isPending ? 'Depositing...' : 'Deposit'}
                </Button>
                <Button variant="outline" onClick={() => setDepositAmount('')}>Clear</Button>
              </div>

              <div className="text-xs text-muted-foreground">Vault: {formatSOL(vaultBalance, 6)} • Available: {formatSOL(availableLiquidity, 6)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdraw</CardTitle>
            <CardDescription>Claim yield, withdraw custom amount, or withdraw percent</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Liquidity alert */}
            {availableLiquidity < currentValue && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Limited liquidity: {formatSOL(availableLiquidity, 6)} SOL available. Some funds are locked in loans.
                </AlertDescription>
              </Alert>
            )}

            <Tabs value={withdrawMode} onValueChange={(v) => setWithdrawMode(v as any)}>
              <TabsList className="grid grid-cols-2 gap-2">
                {/*<TabsTrigger value="interest" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Claim
                </TabsTrigger>*/}
                <TabsTrigger value="custom" className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Custom
                </TabsTrigger>
                <TabsTrigger value="percent" className="flex items-center gap-2">
                  <Percent className="w-4 h-4" /> Percent
                </TabsTrigger>
              </TabsList>

              {/*<TabsContent value="interest">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Available to claim</div>
                    <div className="font-semibold text-green-600">{formatSOL(earnedInterest, 6)} SOL</div>
                  </div>

                  {earnedInterest > 0n && (
                    <div className="text-xs text-muted-foreground">
                      ≈ {sharesForInterest.toString()} shares
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleClaimYield} disabled={claimYieldMutation.isPending || earnedInterest === 0n} className="flex-1">
                      {claimYieldMutation.isPending ? 'Claiming...' : `Claim Yield`}
                    </Button>
                    <Button variant="outline" onClick={() => {}}>Details</Button>
                  </div>
                </div>
              </TabsContent>*/}

              <TabsContent value="custom">
                <div className="space-y-3">
                  <Label htmlFor="custom">Amount (SOL)</Label>
                  <Input
                    id="custom"
                    type="number"
                    step="0.000001"
                    placeholder="0.0"
                    value={customWithdrawAmount}
                    onChange={(e) => setCustomWithdrawAmount(e.target.value)}
                  />

                  {customWithdrawAmount && (
                    <div className="text-xs text-muted-foreground">
                      ≈ {sharesForAmount(BigInt(Math.floor(parseFloat(customWithdrawAmount) * 1_000_000_000))).toString()} shares
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleWithdrawCustom}
                      disabled={withdrawMutation.isPending || !customWithdrawAmount}
                      className="flex-1"
                    >
                      {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw'}
                    </Button>
                    <Button variant="outline" onClick={() => setCustomWithdrawAmount(formatSOL(currentValue, 6))}>Max</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="percent">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Withdraw percent of your holdings</div>
                    <div className="font-semibold">{withdrawPercent}%</div>
                  </div>

                  <Slider value={[withdrawPercent]} onValueChange={(v) => setWithdrawPercent(v[0])} min={0} max={100} step={1} />

                  <div className="text-xs text-muted-foreground">
                    {formatSOL((currentValue * BigInt(withdrawPercent)) / 100n, 6)} SOL ≈ {((shareAmount * BigInt(withdrawPercent)) / 100n).toString()} shares
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleWithdrawPercent} disabled={withdrawMutation.isPending || withdrawPercent === 0} className="flex-1">
                      {withdrawMutation.isPending ? 'Withdrawing...' : 'Withdraw %'}
                    </Button>
                    <Button variant="outline" onClick={() => setWithdrawPercent(100)}>All</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="pt-3 border-t mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div>Shares</div>
                <div className="font-medium">{shareAmount.toString()}</div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div>Current Value</div>
                <div className="font-medium">{formatSOL(currentValue, 6)} SOL</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* small helper card 
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
            <CardDescription>Utilities</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => setWithdrawMode('interest')} className="flex-1">Claim Yield</Button>
            <Button onClick={() => setWithdrawMode('custom')} variant="outline" className="flex-1">Withdraw Custom</Button>
          </CardContent>
        </Card>*/}
      </div>
    </div>
  )
}

/*// src/features/solignition/ui/deposit-withdraw-panel.tsx
import { useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useDepositorRecord } from '../data-access/use-depositor-record'
import { useDepositMutation } from '../data-access/use-deposit-mutation'
import { useWithdrawMutation } from '../data-access/use-withdraw-mutation'
import { useClaimYieldMutation } from '../data-access/use-claim-yield-mutation'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useVaultBalance } from '../data-access/use-vault-balance'
import { DepositorStatsDisplay } from './depositor-stats-display'
import { EnhancedWithdrawPanel } from './withdraw-panal'

export function DepositWithdrawPanel({ account }: { account: UiWalletAccount }) {
  const [depositAmount, setDepositAmount] = useState('')

  const depositorQuery = useDepositorRecord(account.address)
  const configQuery = useProtocolConfig()
  const vaultBalanceQuery = useVaultBalance()
  const depositMutation = useDepositMutation({ account })
  const withdrawMutation = useWithdrawMutation({ account })
  const claimYieldMutation = useClaimYieldMutation({ account })

  const formatSOL = (lamports: bigint) => {
    return (Number(lamports) / 1_000_000_000).toFixed(4)
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) return

    await depositMutation.mutateAsync(BigInt(Math.floor(amount * 1_000_000_000)))
    setDepositAmount('')
  }

  const handleWithdraw = async (amount: bigint) => {
    await withdrawMutation.mutateAsync(amount)
  }

  const handleClaimYield = async () => {
    await claimYieldMutation.mutateAsync()
  }

  if (configQuery.isLoading || depositorQuery.isLoading || vaultBalanceQuery.isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      
      {depositorQuery.data && configQuery.data && (
        <DepositorStatsDisplay
          depositedAmount={depositorQuery.data.data.depositedAmount}
          shareAmount={depositorQuery.data.data.shareAmount}
          totalShares={configQuery.data.data.totalShares}
          totalDeposits={configQuery.data.data.totalDeposits}
          totalYieldDistributed={configQuery.data.data.totalYieldDistributed}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
      
        <Card>
          <CardHeader>
            <CardTitle>Deposit Funds</CardTitle>
            <CardDescription>Deposit SOL to earn yield from loan interest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {configQuery.data && vaultBalanceQuery.data !== undefined && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Earn yield from loan interest and admin fees</p>
                <p>• Your shares increase in value as yield is distributed</p>
                <p>• Claim yield or withdraw</p>
                <p className="pt-2 font-medium">
                  Vault Balance: {formatSOL(vaultBalanceQuery.data)} SOL
                </p>
              </div>
            )}
          </CardContent>
        </Card>

       
        {depositorQuery.data && configQuery.data && vaultBalanceQuery.data !== undefined ? (
          <EnhancedWithdrawPanel
            depositedAmount={depositorQuery.data.data.depositedAmount}
            shareAmount={depositorQuery.data.data.shareAmount}
            totalShares={configQuery.data.data.totalShares}
            totalDeposits={configQuery.data.data.totalDeposits}
            totalYieldDistributed={configQuery.data.data.totalYieldDistributed}
            totalLoansOutstanding={configQuery.data.data.totalLoansOutstanding}
            vaultBalance={vaultBalanceQuery.data}
            onWithdraw={handleWithdraw}
            onClaimYield={handleClaimYield}
            isPending={withdrawMutation.isPending}
            isClaimPending={claimYieldMutation.isPending}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Withdraw Funds</CardTitle>
              <CardDescription>Deposit funds first to enable withdrawals</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No deposits yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

///////////////////////////////////////////////////////////////
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
    <div className="grid gap-4 md:grid-cols-2"> */
      {/* Current Balance Card */} /*
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
 */
      {/* Deposit/Withdraw Actions */} /*
      <Card>
        <CardHeader>
          <CardTitle>Manage Funds</CardTitle>
          <CardDescription>Deposit or withdraw SOL from the protocol</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6"> */

          {/* Deposit */} /*
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
          </div> */

          {/* Withdraw */} /* 
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
}*/