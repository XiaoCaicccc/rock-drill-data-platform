import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', label: '上升' },
  down: { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', label: '下降' },
  neutral: { icon: Minus, color: 'text-slate-500', bg: 'bg-slate-50', label: '持平' },
} as const

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null

  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardContent className="flex items-start gap-4 p-5">
        {/* Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              'mt-1 truncate text-2xl font-bold tracking-tight',
              trend === 'up' && 'text-emerald-700',
              trend === 'down' && 'text-red-700',
              (!trend || trend === 'neutral') && 'text-foreground',
            )}
          >
            {value}
          </p>

          {/* Description / Trend */}
          {(description || trendInfo) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {trendInfo && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
                    trendInfo.bg,
                    trendInfo.color,
                  )}
                >
                  <trendInfo.icon className="h-3 w-3" />
                </span>
              )}
              {description && <span>{description}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}