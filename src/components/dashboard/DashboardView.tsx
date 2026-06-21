'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { LayoutDashboard } from 'lucide-react'

export default function DashboardView() {
  return (
    <PlaceholderView
      viewKey="dashboard"
      icon={<LayoutDashboard className="size-8" />}
      description="数据总览仪表盘 —— 将展示 KPI 卡片、检测趋势图、类别合格率图表等核心统计数据。"
    />
  )
}