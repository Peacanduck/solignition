import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, TrendingUp, Wallet } from 'lucide-react';

interface EnhancedWithdrawPanelProps {
  depositedAmount: bigint;
  shareAmount: bigint;
  totalShares: bigint;
  totalDeposits: bigint;
  totalYieldDistributed: bigint;
  totalLoansOutstanding: bigint;
  vaultBalance: bigint;
  onWithdraw: (amount: bigint) => Promise<void>;
  onClaimYield: () => Promise<void>;
  isPending: boolean;
  isClaimPending: boolean;
}

export function EnhancedWithdrawPanel({
  depositedAmount,
  shareAmount,
  totalShares,
  totalDeposits,
  totalYieldDistributed,
  totalLoansOutstanding,
  vaultBalance,
  onWithdraw,
  onClaimYield,
  isPending,
  isClaimPending
}: EnhancedWithdrawPanelProps) {
  const [customAmount, setCustomAmount] = useState('');
  const [withdrawType, setWithdrawType] = useState<'interest' | 'custom'>('interest');

  // Calculate share price
  const calculateSharePrice = () => {
    if (totalShares === 0n) return 1_000_000_000n;
    const totalAssets = totalDeposits + totalYieldDistributed;
    return (totalAssets * 1_000_000_000n) / totalShares;
  };

  // Calculate current value
  const calculateCurrentValue = () => {
    if (shareAmount === 0n || totalShares === 0n) return 0n;
    const sharePrice = calculateSharePrice();
    return (shareAmount * sharePrice) / 1_000_000_000n;
  };

  // Calculate earned interest
  const calculateEarnedInterest = () => {
    const currentValue = calculateCurrentValue();
    return currentValue > depositedAmount ? currentValue - depositedAmount : 0n;
  };

  // Calculate shares needed to withdraw specific SOL amount
  const calculateSharesForAmount = (solAmount: bigint) => {
    const sharePrice = calculateSharePrice();
    return (solAmount * 1_000_000_000n) / sharePrice;
  };

  // Calculate SOL amount for shares
  const calculateAmountForShares = (shares: bigint) => {
    const sharePrice = calculateSharePrice();
    return (shares * sharePrice) / 1_000_000_000n;
  };

  // Use actual vault balance directly from blockchain
  const availableLiquidity = vaultBalance;
  
  const formatSOL = (lamports: bigint) => {
    return (Number(lamports) / 1_000_000_000).toFixed(6);
  };

  const earnedInterest = calculateEarnedInterest();
  const currentValue = calculateCurrentValue();
  const interestShares = earnedInterest > 0n ? calculateSharesForAmount(earnedInterest) : 0n;

  const handleWithdrawInterest = async () => {
    if (earnedInterest > 0n) {
      await onClaimYield();
    }
  };

  const handleWithdrawCustom = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const amountLamports = BigInt(Math.floor(amount * 1_000_000_000));
    
    // Pass amount directly instead of shares
    await onWithdraw(amountLamports);
    setCustomAmount('');
  };

  const handleWithdrawAll = async () => {
    // Withdraw the full current value
    await onWithdraw(currentValue);
  };

  // Check if withdrawal amount exceeds available liquidity
  const checkLiquidity = (solAmount: bigint) => {
    return solAmount <= availableLiquidity;
  };

  const isInterestWithdrawable = earnedInterest > 0n && checkLiquidity(earnedInterest);
  
  const customAmountBigInt = customAmount 
    ? BigInt(Math.floor(parseFloat(customAmount) * 1_000_000_000)) 
    : 0n;
  
  // For custom withdrawal validation, allow if within reasonable tolerance
  const calculatedShares = customAmountBigInt > 0n ? calculateSharesForAmount(customAmountBigInt) : 0n;
  const isWithdrawingAll = calculatedShares >= shareAmount || shareAmount - calculatedShares < 1000n;
  
  const isCustomWithdrawable = customAmountBigInt > 0n && 
    (isWithdrawingAll || customAmountBigInt <= currentValue) && 
    checkLiquidity(customAmountBigInt);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
        <CardDescription>
          Withdraw your earned interest or principal from the protocol
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Liquidity Warning */}
        {availableLiquidity < currentValue && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Limited liquidity: Only {formatSOL(availableLiquidity)} SOL available for withdrawal.
              {totalLoansOutstanding > 0n && ' Some funds are locked in active loans.'}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={withdrawType} onValueChange={(v) => setWithdrawType(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="interest" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Interest Only
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Custom Amount
            </TabsTrigger>
          </TabsList>

          {/* Withdraw Interest Only */}
          <TabsContent value="interest" className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Earned Interest</span>
                <span className="text-lg font-bold text-green-600">
                  {formatSOL(earnedInterest)} SOL
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shares to burn</span>
                <span className="font-medium">{interestShares.toString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Remaining after withdrawal</span>
                <span className="font-medium">{formatSOL(depositedAmount)} SOL</span>
              </div>
            </div>

            {earnedInterest === 0n ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No interest earned yet. Interest accrues as loans are repaid or recovered.
                </AlertDescription>
              </Alert>
            ) : !isInterestWithdrawable ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Insufficient liquidity to withdraw interest. Available: {formatSOL(availableLiquidity)} SOL
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              onClick={handleWithdrawInterest}
              disabled={isClaimPending || !isInterestWithdrawable}
              className="w-full"
            >
              {isClaimPending ? 'Claiming...' : `Claim Yield (${formatSOL(earnedInterest)} SOL)`}
            </Button>
          </TabsContent>

          {/* Custom Withdrawal */}
          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount to Withdraw (SOL)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                step="0.000001"
                min="0"
                max={formatSOL(currentValue)}
                placeholder="0.0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={isPending}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Available: {formatSOL(currentValue)} SOL</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    // Calculate exact amount for all shares to avoid rounding issues
                    const exactAmount = calculateAmountForShares(shareAmount);
                    setCustomAmount(formatSOL(exactAmount));
                  }}
                >
                  Max
                </Button>
              </div>
            </div>

            {customAmount && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Withdrawal Amount</span>
                  <span className="text-lg font-bold">{customAmount} SOL</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shares to burn</span>
                  <span className="font-medium">
                    {(() => {
                      const amountLamports = BigInt(Math.floor(parseFloat(customAmount) * 1_000_000_000));
                      let shares = calculateSharesForAmount(amountLamports);
                      // Cap at total shares to avoid display issues
                      if (shares >= shareAmount || shareAmount - shares < 1000n) {
                        shares = shareAmount;
                      }
                      return shares.toString();
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining shares</span>
                  <span className="font-medium">
                    {(() => {
                      const amountLamports = BigInt(Math.floor(parseFloat(customAmount) * 1_000_000_000));
                      let shares = calculateSharesForAmount(amountLamports);
                      if (shares >= shareAmount || shareAmount - shares < 1000n) {
                        return "0";
                      }
                      return (shareAmount - shares).toString();
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Remaining value</span>
                  <span className="font-medium">
                    {(() => {
                      const amountLamports = BigInt(Math.floor(parseFloat(customAmount) * 1_000_000_000));
                      let shares = calculateSharesForAmount(amountLamports);
                      if (shares >= shareAmount || shareAmount - shares < 1000n) {
                        return "0.000000 SOL";
                      }
                      return formatSOL(currentValue - amountLamports) + " SOL";
                    })()}
                  </span>
                </div>
              </div>
            )}

            {customAmount && !isCustomWithdrawable && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {customAmountBigInt > currentValue 
                    ? 'Amount exceeds your current value'
                    : 'Insufficient liquidity for this withdrawal'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleWithdrawCustom}
                disabled={isPending || !isCustomWithdrawable}
                variant="default"
              >
                {isPending ? 'Withdrawing...' : 'Withdraw'}
              </Button>
              <Button
                onClick={handleWithdrawAll}
                disabled={isPending || !checkLiquidity(currentValue)}
                variant="outline"
              >
                Withdraw All
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <div className="pt-4 border-t space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your Shares:</span>
            <span className="font-medium">{shareAmount.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Value:</span>
            <span className="font-medium">{formatSOL(currentValue)} SOL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Original Deposit:</span>
            <span className="font-medium">{formatSOL(depositedAmount)} SOL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}