'use client'

import { useAppStore, type ViewType } from '@/store'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SessionProvider, useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Views
const DashboardView = dynamic(
  () => import('@/components/dashboard/DashboardView'),
  { loading: () => <ViewSkeleton /> }
)
const EquipmentView = dynamic(
  () => import('@/components/equipment/EquipmentView'),
  { loading: () => <ViewSkeleton /> }
)
const PartsView = dynamic(
  () => import('@/components/parts/PartsView'),
  { loading: () => <ViewSkeleton /> }
)
const TemplatesView = dynamic(
  () => import('@/components/templates/TemplatesView'),
  { loading: () => <ViewSkeleton /> }
)
const InspectionEntryView = dynamic(
  () => import('@/components/inspections/InspectionEntryView'),
  { loading: () => <ViewSkeleton /> }
)
const InspectionLedgerView = dynamic(
  () => import('@/components/inspections/InspectionLedgerView'),
  { loading: () => <ViewSkeleton /> }
)
const AnalysisView = dynamic(
  () => import('@/components/analysis/AnalysisView'),
  { loading: () => <ViewSkeleton /> }
)
const ReportView = dynamic(
  () => import('@/components/reports/ReportView'),
  { loading: () => <ViewSkeleton /> }
)
const WorkspaceView = dynamic(
  () => import('@/components/workspace/WorkspaceView'),
  { loading: () => <ViewSkeleton /> }
)
const UserManagementView = dynamic(
  () => import('@/components/admin/UserManagement').then((m) => ({ default: m.UserManagement })),
  { loading: () => <ViewSkeleton /> }
)

function ViewSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4 p-6">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted" />
    </div>
  )
}

function ViewRouter({ view }: { view: ViewType }) {
  switch (view) {
    case 'dashboard':
      return <DashboardView />
    case 'equipment':
      return <EquipmentView />
    case 'parts':
      return <PartsView />
    case 'templates':
      return <TemplatesView />
    case 'inspection-entry':
      return <InspectionEntryView />
    case 'inspection-ledger':
      return <InspectionLedgerView />
    case 'analysis':
      return <AnalysisView />
    case 'reports':
      return <ReportView />
    case 'workspace':
      return <WorkspaceView />
    case 'user-management':
      return <UserManagementView />
    default:
      return null
  }
}

function AppShell() {
  const currentView = useAppStore((s) => s.currentView)
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string })?.role

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar userRole={userRole} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-muted/30">
            <ViewRouter view={currentView} />
          </main>
          <footer className="border-t bg-background px-4 py-2">
            <p className="text-center text-xs text-muted-foreground">
              凿岩机全生命周期数据分析与部门助理平台
            </p>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}