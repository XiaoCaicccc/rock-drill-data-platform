'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { FileBarChart } from 'lucide-react'

export default function ReportView() {
  return (
    <PlaceholderView
      viewKey="reports"
      icon={<FileBarChart className="size-8" />}
      description="分析报告管理 —— 编制月度/季度/专项/全生命周期分析报告，管理报告的起草、发布和归档流程。"
    />
  )
}