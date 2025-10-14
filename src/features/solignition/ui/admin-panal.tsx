import { UiWalletAccount } from '@wallet-ui/react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminProtocolControls } from './admin-protocol-controls'
import { AdminConfigPanel } from './admin-config-panal'
import { AdminLoansManagement } from './admin-loans-management'
import { useProtocolConfig } from '../data-access/use-protocol-config'

export function AdminPanel({ account }: { account: UiWalletAccount }) {
  const configQuery = useProtocolConfig()

  // Check if user is admin
  const isAdmin = true//configQuery.data?.data.admin === account.address

  if (configQuery.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin && configQuery.data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold">Access Denied</p>
            <p className="text-muted-foreground">
              You are not the protocol admin. Only the admin can access this panel.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">Manage the Solignition protocol</p>
      </div>

      <Tabs defaultValue="controls" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="loans">Loan Management</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-4">
          <AdminProtocolControls account={account} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <AdminConfigPanel account={account} />
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <AdminLoansManagement account={account} />
        </TabsContent>
      </Tabs>
    </div>
  )
}