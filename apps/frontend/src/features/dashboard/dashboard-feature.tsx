import { AppHero } from '@/components/app-hero.tsx'
import { ProtocolStats } from '../solignition/ui/protocol-stats'
import { useSolana } from '@/components/solana/use-solana';
import { Suspense } from 'react'


export default function DashboardFeature() {
  const { account } = useSolana();
  return (
    <div>
      <AppHero title="Protocol Dashboard" subtitle="overall protocol statistics" />
      <Suspense>
        <ProtocolStats address={account?.address}/>
      </Suspense>
    </div>
  )
}
