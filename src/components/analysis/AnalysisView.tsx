'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { ScatterChart } from 'lucide-react'

export default function AnalysisView() {
  return (
    <PlaceholderView
      viewKey="analysis"
      icon={<ScatterChart className="size-8" />}
      description="配合参数分析 —— 支持参数散点图对比、相关性分析、单参数分布直方图，以及最优区间推荐。"
    />
  )
}