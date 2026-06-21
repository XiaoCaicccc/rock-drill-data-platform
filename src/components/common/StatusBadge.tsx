import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  className?: string
}

const DEFAULT_COLOR_MAP: Record<string, string> = {
  // 检测结果
  '合格': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '优秀': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '不合格': 'bg-red-100 text-red-700 border-red-200',
  '待检': 'bg-amber-100 text-amber-700 border-amber-200',
  '待修': 'bg-orange-100 text-orange-700 border-orange-200',
  // 报告状态
  '草稿': 'bg-slate-100 text-slate-600 border-slate-200',
  '审核中': 'bg-blue-100 text-blue-700 border-blue-200',
  '已发布': 'bg-blue-100 text-blue-700 border-blue-200',
  '已归档': 'bg-slate-200 text-slate-600 border-slate-300',
  // 任务状态
  '待办': 'bg-slate-100 text-slate-600 border-slate-200',
  '进行中': 'bg-orange-100 text-orange-700 border-orange-200',
  '已完成': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  // 会议状态
  '待召开': 'bg-purple-100 text-purple-700 border-purple-200',
  '已完成': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  // 决议状态
  '待执行': 'bg-amber-100 text-amber-700 border-amber-200',
  '执行中': 'bg-orange-100 text-orange-700 border-orange-200',
  // 设备状态
  '在用': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '维修中': 'bg-orange-100 text-orange-700 border-orange-200',
  '退役': 'bg-slate-300 text-slate-600 border-slate-400',
  '库存': 'bg-blue-100 text-blue-700 border-blue-200',
}

export function StatusBadge({ status, colorMap, className }: StatusBadgeProps) {
  const merged = { ...DEFAULT_COLOR_MAP, ...colorMap }
  const colorClasses = merged[status] || 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        colorClasses,
        className,
      )}
    >
      {status}
    </Badge>
  )
}