import { Outlet } from 'react-router'

export default function SolignitionLayout() {
  return (
    <div className="mx-auto max-w-[1280px]">
      <Outlet />
    </div>
  )
}
