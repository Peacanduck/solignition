import { Navigate, useRoutes } from 'react-router'
import { lazy } from 'react'

const AccountDetailFeature = lazy(() => import('@/features/account/account-feature-detail.tsx'))
const AccountIndexFeature = lazy(() => import('@/features/account/account-feature-index.tsx'))

const SolignitionLayout = lazy(() => import('@/features/solignition/solignition-layout'))
const DashboardView = lazy(() => import('@/features/solignition/dashboard-view'))
const ExploreView = lazy(() => import('@/features/solignition/explore-view'))
const EarnView = lazy(() => import('@/features/solignition/earn-view'))
const BorrowView = lazy(() => import('@/features/solignition/borrow/borrow-view'))

export function AppRoutes() {
  return useRoutes([
    { index: true, element: <Navigate to="/solignition/dashboard" replace /> },
    {
      path: 'account',
      children: [
        { index: true, element: <AccountIndexFeature /> },
        { path: ':address', element: <AccountDetailFeature /> },
      ],
    },
    {
      path: 'solignition',
      element: <SolignitionLayout />,
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },
        { path: 'dashboard', element: <DashboardView /> },
        { path: 'explore', element: <ExploreView /> },
        { path: 'borrow', element: <BorrowView /> },
        { path: 'earn', element: <EarnView /> },
      ],
    },
  ])
}
