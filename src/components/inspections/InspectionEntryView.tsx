'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { PenLine } from 'lucide-react'

export default function InspectionEntryView() {
  return (
    <PlaceholderView
      viewKey="inspection-entry"
      icon={<PenLine className="size-8" />}
      description="检测数据录入 —— 支持矩阵式批量录入（单台机头 × 60零件 × 40参数），以及 Excel 文件批量导入。"
    />
  )
}