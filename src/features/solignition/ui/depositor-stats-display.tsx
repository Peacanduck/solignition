import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Coins, DollarSign, Percent } from 'lucide-react';

interface DepositorStatsProps {
  depositedAmount: bigint;
  shareAmount: bigint;
  totalShares: bigint;
  totalDeposits: bigint;
  totalYieldDistributed: bigint;
}

export function DepositorStatsDisplay({
  depositedAmount,
  shareAmount,
  totalShares,
  totalDeposits,
  totalYieldDistributed
}: DepositorStatsProps) {
  
  // Calculate share price (matches contract logic)
  const calculateSharePrice = () => {
    if (totalShares === 0n) {
      return 1_000_000_000n; // 1:1 ratio with 9 decimals
    }
    
    const totalAssets = totalDeposits + totalYieldDistributed;
    return (totalAssets * 1_000_000_000n) / totalShares;
  };

  // Calculate current value of user's shares
  const calculateCurrentValue = () => {
    if (shareAmount === 0n || totalShares === 0n) {
      return 0n;
    }
    
    const sharePrice = calculateSharePrice();
    return (shareAmount * sharePrice) / 1_000_000_000n;
  };

  // Calculate earned interest
  const calculateEarnedInterest = () => {
    const currentValue = calculateCurrentValue();
    return currentValue > depositedAmount ? currentValue - depositedAmount : 0n;
  };

  // Calculate APY (approximate based on yield distributed)
  const calculateAPY = () => {
    if (totalDeposits === 0n) return 0;
    
    const yieldRate = Number(totalYieldDistributed) / Number(totalDeposits);
    return (yieldRate * 100).toFixed(2);
  };

  const formatSOL = (lamports: bigint) => {
    return (Number(lamports) / 1_000_000_000).toFixed(9);
  };

  const currentValue = calculateCurrentValue();
  const earnedInterest = calculateEarnedInterest();
  const sharePrice = calculateSharePrice();
  const apy = calculateAPY();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Principal Deposited 
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Principal Deposited
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatSOL(depositedAmount)}</div>
          <p className="text-xs text-muted-foreground">SOL</p>
        </CardContent>
      </Card>*/}

      {/* Current Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Current Value
          </CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatSOL(currentValue)}</div>
          <p className="text-xs text-muted-foreground">SOL</p>
        </CardContent>
      </Card>

      {/* Interest Earned */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Interest Earned
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatSOL(earnedInterest)}</div>
          <p className="text-xs text-muted-foreground">
            {earnedInterest > 0n 
              ? `+${((Number(earnedInterest) / Number(depositedAmount)) * 100).toFixed(2)}%`
              : '0%'
            }
          </p>
        </CardContent>
      </Card>

      {/* Share Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Your Shares
          </CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{shareAmount.toString()}</div>
          <p className="text-xs text-muted-foreground">
            @ {(Number(sharePrice) / 1_000_000_000).toFixed(5)} SOL/share
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Protocol APY: ~{apy}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}