'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { Puzzle } from 'lucide-react'

export default function PartsView() {
  return (
    <PlaceholderView
      viewKey="parts"
      icon={<Puzzle className="size-8" />}
      description="零件档案管理 —— 实现一件一档，管理零部件的基础信息、所属设备和检测历史。"
    />
  )
}