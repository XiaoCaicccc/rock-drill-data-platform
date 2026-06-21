'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { format } from 'date-fns'
import {
  Activity,
  TrendingUp,
  Target,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

// ---- Types ----

interface KpiData {
  totalInspections: number
  totalParts: number
  totalCategories: number
  pendingReports: number
  thisMonthInspections: number
  thisMonthPassRate: number
  lastMonthPassRate: number
  totalPassRate: number
  pendingTasks: number
}

interface TrendItem {
  month: string
  total: number
  qualified: number
  unqualified: number
  passRate: number
}

interface CategoryItem {
  name: string
  total: number
  qualified: number
  passRate: number
}

interface SupplierItem {
  name: string
  total: number
  qualified: number
  passRate: number
}

interface HardnessItem {
  range: string
  count: number
}

interface RecentInspection {
  id: string
  recordNo: string
  part: {
    name: string
    code: string
    category: { name: string }
  }
  inspector: string
  inspectionDate: string
  result: string
}

interface DashboardData {
  kpi: KpiData
  trendChartData: TrendItem[]
  categoryChartData: CategoryItem[]
  supplierChartData: SupplierItem[]
  hardnessData: HardnessItem[]
  recentInspections: RecentInspection[]
}

// ---- Helpers ----

function getPassRateColor(rate: number): string {
  if (rate >= 95) return '#22c55e'
  if (rate >= 90) return '#f59e0b'
  return '#ef4444'
}

function getResultBadgeVariant(result: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (result) {
    case '合格':
      return 'default'
    case '不合格':
      return 'destructive'
    case '待检':
      return 'outline'
    case '待复检':
      return 'secondary'
    default:
      return 'outline'
  }
}

function getShortMonth(month: string): string {
  // "2025-04" => "4月"
  const parts = month.split('-')
  if (parts.length === 2) {
    return `${parseInt(parts[1], 10)}月`
  }
  return month
}

// ---- Custom Tooltip ----

function ChartTooltipContent({
  active,
  payload,
  label,
  type,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  type?: 'trend' | 'category' | 'supplier' | 'hardness'
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium text-foreground">
            {type === 'trend' && entry.name === '合格率'
              ? `${entry.value}%`
              : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

// ---- KPI Card Skeleton ----

function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <CardAction>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-2 h-8 w-20" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

// ---- Chart Skeleton ----

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

// ---- Table Skeleton ----

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---- KPI Cards ----

function KpiCards({ data }: { data: KpiData }) {
  const trendValue = data.thisMonthPassRate - data.lastMonthPassRate
  const isUp = trendValue >= 0

  const cards = [
    {
      title: '检测总量',
      value: data.totalInspections,
      suffix: '',
      subtext: `零部件种类: ${data.totalParts}`,
      icon: Activity,
      accentBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      title: '本月合格率',
      value: data.thisMonthPassRate,
      suffix: '%',
      subtext: `较上月 ${isUp ? '+' : ''}${trendValue.toFixed(1)}%`,
      icon: TrendingUp,
      accentBg: 'bg-emerald-500/10',
      iconColor: isUp ? 'text-emerald-500' : 'text-red-500',
      trend: (
        <span className={`flex items-center text-xs font-medium ${isUp ? 'text-emerald-500' : 'text-red-500'}`}>
          {isUp ? (
            <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
          )}
          {isUp ? '+' : ''}{trendValue.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '累计合格率',
      value: data.totalPassRate,
      suffix: '%',
      subtext: null,
      icon: Target,
      accentBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      progress: true,
    },
    {
      title: '待办事项',
      value: data.pendingTasks,
      suffix: '',
      subtext: `待发布报告: ${data.pendingReports}`,
      icon: ClipboardList,
      accentBg: 'bg-violet-500/10',
      iconColor: 'text-violet-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader>
              <CardDescription className="text-xs font-medium tracking-wide uppercase">
                {card.title}
              </CardDescription>
              <CardAction>
                <div className={`rounded-lg p-2 ${card.accentBg}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="-mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-primary">
                  {card.value}
                </span>
                {card.suffix && (
                  <span className="text-lg font-semibold text-muted-foreground">
                    {card.suffix}
                  </span>
                )}
              </div>
              <div className="mt-2">
                {card.progress && (
                  <Progress value={card.value} className="mb-2 h-1.5" />
                )}
                {card.trend || (card.subtext && (
                  <p className="text-xs text-muted-foreground">{card.subtext}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ---- Trend Chart ----

function TrendChart({ data }: { data: TrendItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          检测趋势
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tickFormatter={getShortMonth}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="bar"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                domain={[60, 100]}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                content={<ChartTooltipContent type="trend" />}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar yAxisId="bar" dataKey="total" name="检测总量" fill="#94a3b8" radius={[2, 2, 0, 0]} barSize={16} />
              <Bar yAxisId="bar" dataKey="qualified" name="合格数量" fill="#22c55e" radius={[2, 2, 0, 0]} barSize={16} />
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="passRate"
                name="合格率"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Category Pass Rate Chart (Horizontal Bar) ----

function CategoryChart({ data }: { data: CategoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          类别合格率
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                content={<ChartTooltipContent type="category" />}
                formatter={(value: number) => [`${value}%`, '合格率']}
              />
              <Bar
                dataKey="passRate"
                name="合格率"
                radius={[0, 4, 4, 0]}
                barSize={18}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={getPassRateColor(entry.passRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Supplier Pass Rate Chart ----

function SupplierChart({ data }: { data: SupplierItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          供应商合格率对比
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                content={<ChartTooltipContent type="supplier" />}
                formatter={(value: number) => [`${value}%`, '合格率']}
              />
              <Bar dataKey="passRate" name="合格率" radius={[4, 4, 0, 0]} barSize={28}>
                {data.map((entry, index) => (
                  <Cell key={index} fill={getPassRateColor(entry.passRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Hardness Distribution Chart ----

function HardnessChart({ data }: { data: HardnessItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          硬度分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltipContent type="hardness" />}
                formatter={(value: number) => [value, '数量']}
              />
              <Bar dataKey="count" name="数量" radius={[4, 4, 0, 0]} barSize={32}>
                {data.map((_, index) => {
                  const amberShades = ['#f59e0b', '#f97316', '#fb923c', '#fbbf24', '#d97706']
                  return (
                    <Cell
                      key={index}
                      fill={amberShades[index % amberShades.length]}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Recent Inspections Table ----

function RecentInspectionsTable({ data, onViewAll }: { data: RecentInspection[]; onViewAll: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          最近检测记录
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs text-muted-foreground hover:text-foreground">
            查看全部
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">检测编号</TableHead>
              <TableHead className="text-xs">零部件</TableHead>
              <TableHead className="text-xs">类别</TableHead>
              <TableHead className="text-xs">检测员</TableHead>
              <TableHead className="text-xs">检测日期</TableHead>
              <TableHead className="text-xs">结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs font-mono">{item.recordNo}</TableCell>
                <TableCell className="text-xs">
                  <div>
                    <span className="font-medium">{item.part.name}</span>
                    <span className="ml-1.5 text-muted-foreground">{item.part.code}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.part.category.name}</TableCell>
                <TableCell className="text-xs">{item.inspector}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(item.inspectionDate), 'yyyy-MM-dd')}
                </TableCell>
                <TableCell>
                  <Badge variant={getResultBadgeVariant(item.result)}>
                    {item.result}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                  暂无检测记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ---- Main Dashboard View ----

export default function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { setCurrentView } = useAppStore()

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) throw new Error('Failed to fetch dashboard data')
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const handleViewAll = () => {
    setCurrentView('ledger')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ChartCardSkeleton />
          </div>
          <div className="lg:col-span-2">
            <ChartCardSkeleton />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
        <TableSkeleton />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">加载仪表盘数据失败，请刷新页面重试。</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section aria-label="关键指标">
        <KpiCards data={data.kpi} />
      </section>

      {/* Charts Row 1: Trend (60%) + Category (40%) */}
      <section aria-label="检测趋势与类别分析" className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TrendChart data={data.trendChartData} />
        </div>
        <div className="lg:col-span-2">
          <CategoryChart data={data.categoryChartData} />
        </div>
      </section>

      {/* Charts Row 2: Supplier + Hardness */}
      <section aria-label="供应商与硬度分析" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-1">
          <SupplierChart data={data.supplierChartData} />
        </div>
        <div className="lg:col-span-1">
          <HardnessChart data={data.hardnessData} />
        </div>
      </section>

      {/* Recent Inspections */}
      <section aria-label="最近检测记录">
        <RecentInspectionsTable data={data.recentInspections} onViewAll={handleViewAll} />
      </section>
    </div>
  )
}
