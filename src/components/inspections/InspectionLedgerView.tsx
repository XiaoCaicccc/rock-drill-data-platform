'use client'

import { PlaceholderView } from '@/components/views/PlaceholderView'
import { ScrollText } from 'lucide-react'

export default function InspectionLedgerView() {
  return (
    <PlaceholderView
      viewKey="inspection-ledger"
      icon={<ScrollText className="size-8" />}
      description="检测台账查询 —— 按设备、零件、类别、日期等条件检索检测记录，查看检测明细并导出数据。"
    />
  )
}