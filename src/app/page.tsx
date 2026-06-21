'use client'

import { useAppStore, type ViewType } from '@/store'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { TooltipProvider } from '@/components/ui/tooltip'

// 视图组件（懒加载占位，后续逐步替换为实际功能）
import dynamic from 'next/dynamic'

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

/** 视图切换时的加载骨架 */
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

/** 根据当前视图标识渲染对应组件 */
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
    default:
      return null
  }
}

export default function Home() {
  const currentView = useAppStore((s) => s.currentView)

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* 侧边栏 */}
        <AppSidebar />

        {/* 主内容区 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 顶部栏 */}
          <AppHeader />

          {/* 视图内容 */}
          <main className="flex-1 overflow-y-auto bg-muted/30">
            <ViewRouter view={currentView} />
          </main>

          {/* 底部栏 */}
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