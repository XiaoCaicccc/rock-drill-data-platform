'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { SlidersHorizontal } from 'lucide-react'

export default function TemplatesView() {
  return (
    <PlaceholderView
      viewKey="templates"
      icon={<SlidersHorizontal className="size-8" />}
      description="检测参数模板管理 —— 按零件类别配置检测参数项（名称、单位、标准区间、最优区间等），支持拖拽排序。"
    />
  )
}