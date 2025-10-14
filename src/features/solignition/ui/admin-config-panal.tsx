import { useState } from 'react'
import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useProtocolConfig } from '../data-access/use-protocol-config'
import { useUpdateConfigMutation } from '../data-access/use-update-config-mutation'
import { address } from '@solana/kit'

export function AdminConfigPanel({ account }: { account: UiWalletAccount }) {
  const [adminFeeSplit, setAdminFeeSplit] = useState('')
  const [defaultInterestRate, setDefaultInterestRate] = useState('')
  const [defaultAdminFee, setDefaultAdminFee] = useState('')
  const [deployerAddress, setDeployerAddress] = useState('')
  const [treasuryAddress, setTreasuryAddress] = useState('')

  const configQuery = useProtocolConfig()
  const updateConfigMutation = useUpdateConfigMutation({ account })

  const handleUpdateConfig = async () => {
    const params: any = {}

    if (adminFeeSplit) {
      params.adminFeeSplitBps = Math.floor(parseFloat(adminFeeSplit) * 100)
    }
    if (defaultInterestRate) {
      params.defaultInterestRateBps = Math.floor(parseFloat(defaultInterestRate) * 100)
    }
    if (defaultAdminFee) {
      params.defaultAdminFeeBps = Math.floor(parseFloat(defaultAdminFee) * 100)
    }
    if (deployerAddress) {
      params.deployer = address(deployerAddress)
    }
    if (treasuryAddress) {
      params.treasury = address(treasuryAddress)
    }

    if (Object.keys(params).length === 0) return

    await updateConfigMutation.mutateAsync(params)

    // Reset form
    setAdminFeeSplit('')
    setDefaultInterestRate('')
    setDefaultAdminFee('')
    setDeployerAddress('')
    setTreasuryAddress('')
  }

  const hasChanges =
    adminFeeSplit || defaultInterestRate || defaultAdminFee || deployerAddress || treasuryAddress

  if (configQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Protocol Configuration</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!configQuery.data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Protocol not initialized. Initialize it first.</p>
        </CardContent>
      </Card>
    )
  }

  const config = configQuery.data.data

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Current Configuration</CardTitle>
          <CardDescription>Current protocol parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Admin Fee Split</p>
            <p className="text-lg font-semibold">{(config.adminFeeSplitBps / 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Default Interest Rate</p>
            <p className="text-lg font-semibold">{(config.defaultInterestRateBps / 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Default Admin Fee</p>
            <p className="text-lg font-semibold">{(config.defaultAdminFeeBps / 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deployer</p>
            <p className="text-sm font-mono break-all">{config.deployer}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Treasury</p>
            <p className="text-sm font-mono break-all">{config.treasury}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Admin</p>
            <p className="text-sm font-mono break-all">{config.admin}</p>
          </div>
        </CardContent>
      </Card>

      {/* Update Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Update Configuration</CardTitle>
          <CardDescription>Modify protocol parameters (leave blank to keep current)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="update-admin-fee-split">Admin Fee Split (%)</Label>
            <Input
              id="update-admin-fee-split"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder={(config.adminFeeSplitBps / 100).toFixed(1)}
              value={adminFeeSplit}
              onChange={(e) => setAdminFeeSplit(e.target.value)}
              disabled={updateConfigMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-default-interest">Default Interest Rate (%)</Label>
            <Input
              id="update-default-interest"
              type="number"
              step="0.1"
              min="0"
              placeholder={(config.defaultInterestRateBps / 100).toFixed(1)}
              value={defaultInterestRate}
              onChange={(e) => setDefaultInterestRate(e.target.value)}
              disabled={updateConfigMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-default-admin-fee">Default Admin Fee (%)</Label>
            <Input
              id="update-default-admin-fee"
              type="number"
              step="0.1"
              min="0"
              placeholder={(config.defaultAdminFeeBps / 100).toFixed(1)}
              value={defaultAdminFee}
              onChange={(e) => setDefaultAdminFee(e.target.value)}
              disabled={updateConfigMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-deployer">Deployer Address</Label>
            <Input
              id="update-deployer"
              type="text"
              placeholder={config.deployer}
              value={deployerAddress}
              onChange={(e) => setDeployerAddress(e.target.value)}
              disabled={updateConfigMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="update-treasury">Treasury Address</Label>
            <Input
              id="update-treasury"
              type="text"
              placeholder={config.treasury}
              value={treasuryAddress}
              onChange={(e) => setTreasuryAddress(e.target.value)}
              disabled={updateConfigMutation.isPending}
            />
          </div>

          <Button
            onClick={handleUpdateConfig}
            disabled={updateConfigMutation.isPending || !hasChanges}
            className="w-full"
          >
            {updateConfigMutation.isPending ? 'Updating...' : 'Update Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}