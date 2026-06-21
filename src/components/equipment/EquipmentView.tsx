'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { Server } from 'lucide-react'

export default function EquipmentView() {
  return (
    <PlaceholderView
      viewKey="equipment"
      icon={<Server className="size-8" />}
      description="设备档案管理 —— 实现一机一档，管理凿岩机设备的台账信息、状态追踪和关联零件。"
    />
  )
}