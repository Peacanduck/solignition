import { useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useInitializeProtocolMutation } from '../data-access/use-initialize-mutation'
import { useSetPausedMutation } from '../data-access/use-set-paused-mutation'
import { address } from '@solana/kit'

export function AdminProtocolControls({ account }: { account: UiWalletAccount }) {
  const [adminFeeSplit, setAdminFeeSplit] = useState('50')
  const [defaultInterestRate, setDefaultInterestRate] = useState('5')
  const [defaultAdminFee, setDefaultAdminFee] = useState('1')
  const [deployerAddress, setDeployerAddress] = useState('')

  const configQuery = useProtocolConfig()
  const initializeMutation = useInitializeProtocolMutation({ account })
  const setPausedMutation = useSetPausedMutation({ account })

  const handleInitialize = async () => {
    if (!deployerAddress) return

    await initializeMutation.mutateAsync({
      adminFeeSplitBps: Math.floor(parseFloat(adminFeeSplit) * 100),
      defaultInterestRateBps: Math.floor(parseFloat(defaultInterestRate) * 100),
      defaultAdminFeeBps: Math.floor(parseFloat(defaultAdminFee) * 100),
      deployer: address(deployerAddress),
    })
  }

  const handleTogglePause = async () => {
    if (!configQuery.data) return
    await setPausedMutation.mutateAsync(!configQuery.data.data.isPaused)
  }

  if (configQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol Controls</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  const isInitialized = !!configQuery.data

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Initialize Protocol */}
      {!isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle>Initialize Protocol</CardTitle>
            <CardDescription>Set up the protocol with initial configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-fee-split">Admin Fee Split (%)</Label>
              <Input
                id="admin-fee-split"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="50"
                value={adminFeeSplit}
                onChange={(e) => setAdminFeeSplit(e.target.value)}
                disabled={initializeMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-interest">Default Interest Rate (%)</Label>
              <Input
                id="default-interest"
                type="number"
                step="0.1"
                min="0"
                placeholder="5"
                value={defaultInterestRate}
                onChange={(e) => setDefaultInterestRate(e.target.value)}
                disabled={initializeMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-admin-fee">Default Admin Fee (%)</Label>
              <Input
                id="default-admin-fee"
                type="number"
                step="0.1"
                min="0"
                placeholder="1"
                value={defaultAdminFee}
                onChange={(e) => setDefaultAdminFee(e.target.value)}
                disabled={initializeMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deployer">Deployer Address</Label>
              <Input
                id="deployer"
                type="text"
                placeholder="Solana address"
                value={deployerAddress}
                onChange={(e) => setDeployerAddress(e.target.value)}
                disabled={initializeMutation.isPending}
              />
            </div>

            <Button
              onClick={handleInitialize}
              disabled={initializeMutation.isPending || !deployerAddress}
              className="w-full"
            >
              {initializeMutation.isPending ? 'Initializing...' : 'Initialize Protocol'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Protocol Status & Controls */}
      {isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Protocol Status
              {configQuery.data.data.isPaused ? (
                <Badge variant="destructive">Paused</Badge>
              ) : (
                <Badge className="bg-green-500">Active</Badge>
              )}
            </CardTitle>
            <CardDescription>Current protocol status and emergency controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The protocol is currently {configQuery.data.data.isPaused ? 'paused' : 'active'}. Users{' '}
                {configQuery.data.data.isPaused ? 'cannot' : 'can'} interact with the protocol.
              </p>
            </div>

            <Button
              onClick={handleTogglePause}
              disabled={setPausedMutation.isPending}
              variant={configQuery.data.data.isPaused ? 'default' : 'destructive'}
              className="w-full"
            >
              {setPausedMutation.isPending
                ? 'Processing...'
                : configQuery.data.data.isPaused
                  ? 'Unpause Protocol'
                  : 'Pause Protocol'}
            </Button>

            <p className="text-xs text-muted-foreground">
              {configQuery.data.data.isPaused
                ? 'Unpausing will allow users to deposit, withdraw, and request loans.'
                : 'Pausing will prevent new deposits and loan requests. Existing loans can still be repaid.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}