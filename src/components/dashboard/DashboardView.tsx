'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
  HeartPulse,
} from 'lucide-react'
import { useAppStore } from '@/store'

/* ================================================================
   Types
   ================================================================ */

interface DashboardData {
  totalInspections: number
  thisMonthInspections: number
  overallQualifiedRate: number
  thisMonthQualifiedRate: number
  rateDiff: number
  categoryRates: { name: string; code: string; qualifiedRate: number }[]
  monthlyTrend: { month: string; count: number; qualifiedRate: number }[]
  equipmentHealth: {
    equipmentId: string
    machineNo: string
    lastInspectionDate: string
    qualifiedRate: number
  }[]
  recentInspections: {
    id: string
    record_no: string
    inspector: string
    inspection_date: string
    overall_result: string
    batch_no: string | null
    equipment: { machine_no: string; model: string } | null
    dataItemCount: number
  }[]
  pendingTasks: number
}

/* ================================================================
   Component
   ================================================================ */

export default function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const setCurrentView = useAppStore(s => s.setCurrentView)

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '加载失败')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载仪表盘数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  /* ─── helpers ─── */
  const rateColor = (r: number) =>
    r >= 90 ? 'text-emerald-600' : r >= 80 ? 'text-amber-600' : 'text-red-600'

  const barColor = (r: number) =>
    r >= 90 ? '#10b981' : r >= 80 ? '#f59e0b' : '#ef4444'

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="数据总览" description="凿岩机全生命周期数据分析核心指标" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  /* ─── Error ─── */
  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="数据总览" description="凿岩机全生命周期数据分析核心指标" />
        <EmptyState
          icon={Activity}
          title="加载失败"
          description={error}
          action={{ label: '重新加载', onClick: fetchDashboard }}
        />
      </div>
    )
  }

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      <PageHeader title="数据总览" description="凿岩机全生命周期数据分析核心指标" />

      {/* ── 1. KPI StatCards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="检测总量"
          value={data.totalInspections}
          icon={Activity}
          description={`${data.thisMonthInspections} 条本月`}
        />
        <StatCard
          title="本月合格率"
          value={`${data.thisMonthQualifiedRate}%`}
          icon={TrendingUp}
          trend={data.rateDiff > 0.5 ? 'up' : data.rateDiff < -0.5 ? 'down' : 'neutral'}
          description={`环比 ${data.rateDiff > 0 ? '+' : ''}${data.rateDiff}%`}
        />
        <StatCard
          title="累计合格率"
          value={`${data.overallQualifiedRate}%`}
          icon={CheckCircle2}
          className={data.overallQualifiedRate >= 90 ? 'border-l-4 border-l-emerald-500' : data.overallQualifiedRate >= 80 ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-red-500'}
        />
        <StatCard
          title="待办事项"
          value={data.pendingTasks}
          icon={ClipboardList}
        />
      </div>

      {/* ── 2. 趋势图 + 类别合格率 ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 月度趋势 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">近 6 个月检测趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTrend.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    unit="%"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 13 }}
                    formatter={(value: number, name: string) =>
                      name === '检测数' ? [value, '检测数'] : [`${value}%`, '合格率']
                    }
                  />
                  <Bar yAxisId="left" dataKey="count" name="检测数" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="qualifiedRate"
                    name="合格率"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 类别合格率 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">类别合格率</CardTitle>
          </CardHeader>
          <CardContent>
            {data.categoryRates.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {data.categoryRates.map(c => (
                  <div key={c.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.code}
                        </Badge>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <span className={`font-semibold tabular-nums ${rateColor(c.qualifiedRate)}`}>
                        {c.qualifiedRate}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(c.qualifiedRate, 100)}%`,
                          backgroundColor: barColor(c.qualifiedRate),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. 设备健康度 + 最近检测 ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 设备健康度 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <HeartPulse className="size-4 text-rose-500" />
              设备健康度
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.equipmentHealth.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                暂无检测数据
              </div>
            ) : (
              <div className="space-y-4">
                {data.equipmentHealth.map(eq => (
                  <div
                    key={eq.equipmentId}
                    className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{eq.machineNo}</span>
                        <span className={`text-lg font-bold tabular-nums ${rateColor(eq.qualifiedRate)}`}>
                          {eq.qualifiedRate}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        最近检测：{format(new Date(eq.lastInspectionDate), 'yyyy-MM-dd')}
                      </p>
                      <Progress
                        value={eq.qualifiedRate}
                        className="mt-2 h-1.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近检测记录 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">最近检测记录</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setCurrentView('inspection-ledger')}
            >
              查看全部
              <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentInspections.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                暂无检测记录
              </div>
            ) : (
              <div className="divide-y">
                {data.recentInspections.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setCurrentView('inspection-ledger')}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/50 rounded-md px-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.record_no}
                        </span>
                        <StatusBadge status={r.overall_result} />
                      </div>
                      <p className="mt-0.5 truncate text-sm">
                        {r.equipment
                          ? `${r.equipment.machine_no}（${r.equipment.model}）`
                          : '—'}
                        {' · '}
                        <span className="text-muted-foreground">{r.inspector}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.inspection_date), 'MM-dd')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.dataItemCount} 项
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}