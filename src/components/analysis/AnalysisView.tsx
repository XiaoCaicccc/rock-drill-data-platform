'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ArrowRightLeft, BarChart3 } from 'lucide-react'

/* ================================================================
   Types
   ================================================================ */

interface ParamItem {
  id: string
  param_name: string
  param_code: string
  unit: string | null
  data_type: string
  standard_min: number | null
  standard_max: number | null
  optimal_min: number | null
  optimal_max: number | null
}

interface Category {
  id: string
  name: string
  code: string
  part_count: number
  template: { items: ParamItem[] } | null
}

interface Equipment {
  id: string
  machine_no: string
  model: string
}

interface DataPoint {
  valueA: number
  valueB: number
  isQualified: boolean
  partCode: string
  recordNo: string
}

interface ParamInfo {
  id: string
  param_name: string
  param_code: string
  unit: string
}

interface DistBin {
  rangeLabel: string
  count: number
}

interface AnalysisResult {
  paramA: ParamInfo
  paramB: ParamInfo
  dataPoints: DataPoint[]
  correlation: number | null
  distributionA: DistBin[]
  distributionB: DistBin[]
}

interface ParsedBin {
  index: number
  rangeLabel: string
  lo: number
  hi: number
  count: number
}

/* ================================================================
   Helpers
   ================================================================ */

function parseBins(distribution: DistBin[]): ParsedBin[] {
  return distribution.map((d, i) => {
    const [loStr, hiStr] = d.rangeLabel.split('~')
    const lo = parseFloat(loStr)
    const hi = parseFloat(hiStr)
    return { index: i, rangeLabel: d.rangeLabel, lo, hi, count: d.count }
  })
}

function valueToBinIndex(value: number, bins: ParsedBin[]): number | null {
  if (!bins.length) return null
  const rangeStart = bins[0].lo
  const rangeEnd = bins[bins.length - 1].hi
  const totalRange = rangeEnd - rangeStart
  if (totalRange === 0) return null
  if (value < rangeStart || value > rangeEnd) return null
  // Bin 0 center = index 0 → (value - rangeStart) / binWidth - 0.5
  return (value - rangeStart) / (totalRange / 10) - 0.5
}

function calcStats(values: number[]) {
  const n = values.length
  if (n === 0) return { mean: 0, std: 0, n: 0 }
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  return { mean, std: Math.sqrt(variance), n }
}

function getCorrelationInfo(r: number) {
  const abs = Math.abs(r)
  if (abs >= 0.8)
    return {
      label: r >= 0 ? '强正相关' : '强负相关',
      color: r >= 0 ? 'text-emerald-600' : 'text-red-600',
      bg: r >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
      badge: r >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
    }
  if (abs >= 0.5)
    return {
      label: r >= 0 ? '中等正相关' : '中等负相关',
      color: r >= 0 ? 'text-teal-600' : 'text-orange-600',
      bg: r >= 0 ? 'bg-teal-50 border-teal-200' : 'bg-orange-50 border-orange-200',
      badge: r >= 0 ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700',
    }
  if (abs >= 0.3)
    return {
      label: r >= 0 ? '弱正相关' : '弱负相关',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-100 text-amber-700',
    }
  return {
    label: '无明显相关',
    color: 'text-slate-500',
    bg: 'bg-slate-50 border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  }
}

/* ================================================================
   Sub-components
   ================================================================ */

/** 散点图 Tooltip */
function ScatterTooltip({
  active,
  payload,
  nameA,
  unitA,
  nameB,
  unitB,
}: {
  active?: boolean
  payload?: Array<{ payload: DataPoint }>
  nameA: string
  unitA: string
  nameB: string
  unitB: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
      <div className="font-medium">
        {d.partCode} · {d.recordNo}
      </div>
      <div className="mt-1 space-y-0.5 text-muted-foreground">
        <div>
          {nameA}: <span className="font-medium text-foreground">{d.valueA}</span> {unitA}
        </div>
        <div>
          {nameB}: <span className="font-medium text-foreground">{d.valueB}</span> {unitB}
        </div>
        <div>
          状态:{' '}
          <span className={d.isQualified ? 'text-emerald-600' : 'text-red-600'}>
            {d.isQualified ? '合格' : '不合格'}
          </span>
        </div>
      </div>
    </div>
  )
}

/** 直方图 Tooltip */
function HistTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ParsedBin }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-sm">
      <div className="font-medium">{d.rangeLabel}</div>
      <div className="text-muted-foreground">频次: {d.count}</div>
    </div>
  )
}

/** 单参数直方图卡片 */
function HistogramCard({
  title,
  unit,
  param,
  distribution,
}: {
  title: string
  unit: string
  param: ParamItem | undefined
  distribution: DistBin[]
}) {
  const bins = useMemo(() => parseBins(distribution), [distribution])
  if (!bins.length) return null

  // 计算标准/最优区间的 bin index 位置（用于 ReferenceLine）
  const refLine = (value: number | null) =>
    value != null ? valueToBinIndex(value, bins) : null

  const stdMin = refLine(param?.standard_min)
  const stdMax = refLine(param?.standard_max)
  const optMin = refLine(param?.optimal_min)
  const optMax = refLine(param?.optimal_max)
  const hasStd = stdMin != null || stdMax != null
  const hasOpt = optMin != null || optMax != null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          {title}
          {unit && (
            <span className="text-xs font-normal text-muted-foreground">
              ({unit})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              type="number"
              dataKey="index"
              domain={[-0.5, 9.5]}
              ticks={bins.map((_, i) => i)}
              tickFormatter={(i: number) => bins[i]?.lo.toFixed(1) ?? ''}
              tick={{ fontSize: 9, angle: -45, textAnchor: 'end' }}
              interval={0}
              height={50}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip
              content={<HistTooltip />}
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />

            {/* 标准区间 — 蓝色虚线 */}
            {stdMin != null && (
              <ReferenceLine
                x={stdMin}
                stroke="#3b82f6"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: '标准下限', position: 'top', fontSize: 10, fill: '#3b82f6' }}
              />
            )}
            {stdMax != null && (
              <ReferenceLine
                x={stdMax}
                stroke="#3b82f6"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: '标准上限', position: 'top', fontSize: 10, fill: '#3b82f6' }}
              />
            )}
            {/* 最优区间 — 绿色虚线 */}
            {optMin != null && (
              <ReferenceLine
                x={optMin}
                stroke="#22c55e"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: '最优下限', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
              />
            )}
            {optMax != null && (
              <ReferenceLine
                x={optMax}
                stroke="#22c55e"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: '最优上限', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>

        {/* 图例 */}
        {(hasStd || hasOpt) && (
          <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            {hasStd && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-blue-500" />
                标准区间
              </span>
            )}
            {hasOpt && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0 w-4 border-t-2 border-dashed border-green-500" />
                最优区间
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 加载骨架屏 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card><CardContent className="pt-6"><Skeleton className="h-[380px] w-full" /></CardContent></Card>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-[380px] w-full" /></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-[280px] w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-[280px] w-full" /></CardContent></Card>
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
    </div>
  )
}

/* ================================================================
   Main Component
   ================================================================ */

export default function AnalysisView() {
  /* ── state ── */
  const [categories, setCategories] = useState<Category[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [parameters, setParameters] = useState<ParamItem[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [paramAId, setParamAId] = useState('')
  const [paramBId, setParamBId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')

  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [paramLoading, setParamLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController>(null)

  /* ── 1. 加载类别 + 设备 ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [catRes, eqRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/equipment'),
        ])
        if (cancelled) return
        const catData = await catRes.json()
        const eqData = await eqRes.json()
        setCategories(catData.categories ?? [])
        setEquipment(eqData.equipment ?? [])
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setInitLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /* ── 2. 类别变更 → 加载参数列表 ── */
  useEffect(() => {
    setParamAId('')
    setParamBId('')
    setResult(null)
    setError(null)

    if (!categoryId) { setParameters([]); return }

    let cancelled = false
    setParamLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/parameter-templates?categoryId=${categoryId}`)
        if (cancelled) return
        const data = await res.json()
        const tpl = data.templates?.[0]
        setParameters(
          tpl?.items?.filter((it: ParamItem) => it.data_type === 'number') ?? [],
        )
      } catch {
        if (!cancelled) setParameters([])
      } finally {
        if (!cancelled) setParamLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [categoryId])

  /* ── 3. 参数选定后防抖查询 ── */
  const fetchAnalysis = useCallback(async () => {
    if (!paramAId || !paramBId) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ paramA_id: paramAId, paramB_id: paramBId })
      if (categoryId) qs.set('category_id', categoryId)
      if (equipmentId) qs.set('equipment_id', equipmentId)

      const res = await fetch(`/api/analysis/param-comparison?${qs}`, { signal: ctrl.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as Record<string, string>).error ?? `查询失败 (${res.status})`)
      }
      setResult(await res.json())
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : '查询失败')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [paramAId, paramBId, categoryId, equipmentId])

  useEffect(() => {
    if (!paramAId || !paramBId) { setResult(null); return }
    const t = setTimeout(fetchAnalysis, 500)
    return () => clearTimeout(t)
  }, [fetchAnalysis])

  /* ── derived ── */
  const paramADetail = useMemo(() => parameters.find(p => p.id === paramAId), [parameters, paramAId])
  const paramBDetail = useMemo(() => parameters.find(p => p.id === paramBId), [parameters, paramBId])
  const paramBOptions = useMemo(() => paramAId ? parameters.filter(p => p.id !== paramAId) : parameters, [parameters, paramAId])
  const catsWithTpl = useMemo(() => categories.filter(c => c.template), [categories])

  const qualified = useMemo(() => result?.dataPoints.filter(d => d.isQualified) ?? [], [result])
  const unqualified = useMemo(() => result?.dataPoints.filter(d => !d.isQualified) ?? [], [result])
  const statsA = useMemo(() => result?.dataPoints.length ? calcStats(result.dataPoints.map(d => d.valueA)) : null, [result])
  const statsB = useMemo(() => result?.dataPoints.length ? calcStats(result.dataPoints.map(d => d.valueB)) : null, [result])
  const corrInfo = useMemo(() => result?.correlation != null ? getCorrelationInfo(result.correlation) : null, [result])

  /* ── handlers ── */
  const onCategoryChange = (v: string) => setCategoryId(v)
  const onParamAChange = (v: string) => { setParamAId(v); if (v === paramBId) setParamBId('') }
  const onParamBChange = (v: string) => { setParamBId(v); if (v === paramAId) setParamAId('') }
  const onEquipmentChange = (v: string) => setEquipmentId(v === 'all' ? '' : v)

  /* ── render ── */
  const hasData = !loading && !error && result && result.dataPoints.length > 0
  const isEmpty = !loading && !error && result && result.dataPoints.length === 0
  const showHint = !paramAId && !paramBId && !loading && !error && !result

  return (
    <div className="space-y-6">
      <PageHeader
        title="配合参数分析"
        description="选择两个检测参数，分析其相关性、分布特征和统计指标"
      />

      {/* ── 参数选择器 ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 类别 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">零件类别</Label>
              <Select value={categoryId} onValueChange={onCategoryChange} disabled={initLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={initLoading ? '加载中...' : '选择类别'} />
                </SelectTrigger>
                <SelectContent>
                  {catsWithTpl.length === 0 && !initLoading && (
                    <SelectItem value="__none" disabled>暂无已配置模板的类别</SelectItem>
                  )}
                  {catsWithTpl.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span>{' '}
                      {c.name}
                      <span className="ml-1 text-xs text-muted-foreground">({c.part_count}件)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 参数 A */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">参数 A（X 轴）</Label>
              <Select value={paramAId} onValueChange={onParamAChange} disabled={!categoryId || paramLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={paramLoading ? '加载中...' : !categoryId ? '请先选类别' : '选择参数 A'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {parameters.length === 0 && !paramLoading && (
                    <SelectItem value="__none" disabled>该类别无数值型参数</SelectItem>
                  )}
                  {parameters.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === paramBId}>
                      <span className="font-mono text-xs text-muted-foreground">{p.param_code}</span>{' '}
                      {p.param_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 参数 B */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">参数 B（Y 轴）</Label>
              <Select value={paramBId} onValueChange={onParamBChange} disabled={!categoryId || paramLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={paramLoading ? '加载中...' : !categoryId ? '请先选类别' : '选择参数 B'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {paramBOptions.length === 0 && !paramLoading && (
                    <SelectItem value="__none" disabled>{paramAId ? '无可选参数' : '请先选类别'}</SelectItem>
                  )}
                  {paramBOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono text-xs text-muted-foreground">{p.param_code}</span>{' '}
                      {p.param_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 设备（可选） */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">设备筛选（可选）</Label>
              <Select value={equipmentId || 'all'} onValueChange={onEquipmentChange} disabled={initLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部设备" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部设备</SelectItem>
                  {equipment.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.machine_no}{' '}
                      <span className="text-xs text-muted-foreground">{eq.model}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 空提示 ── */}
      {showHint && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <ArrowRightLeft className="h-8 w-8 opacity-40" />
          <p>请选择零件类别和两个检测参数开始分析</p>
          <p className="text-xs">选定两个参数后将自动进行相关性分析</p>
        </div>
      )}

      {/* ── 加载态 ── */}
      {loading && <LoadingSkeleton />}

      {/* ── 错误态 ── */}
      {!loading && error && (
        <EmptyState
          title="分析查询失败"
          description={error}
          action={{ label: '重试', onClick: fetchAnalysis }}
        />
      )}

      {/* ── 无匹配数据 ── */}
      {isEmpty && (
        <EmptyState
          title="无匹配数据"
          description="所选参数组合在当前筛选条件下没有检测数据，请尝试更换参数或调整筛选条件"
        />
      )}

      {/* ── 分析结果 ── */}
      {hasData && (
        <div className="space-y-6">
          {/* 散点图 + 相关系数 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 散点图 */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  散点图 — {result.paramA.param_name} vs {result.paramB.param_name}
                </CardTitle>
                <CardDescription>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />合格
                  </span>
                  <span className="mx-2 text-border">|</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />不合格
                  </span>
                  <span className="mx-2 text-border">|</span>
                  共 {result.dataPoints.length} 个样本
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={380}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="valueA"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: `${result.paramA.param_name}${result.paramA.unit ? ` (${result.paramA.unit})` : ''}`,
                        position: 'insideBottom',
                        offset: -15,
                        style: { fontSize: 12 },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="valueB"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: `${result.paramB.param_name}${result.paramB.unit ? ` (${result.paramB.unit})` : ''}`,
                        angle: -90,
                        position: 'insideLeft',
                        offset: 15,
                        style: { fontSize: 12 },
                      }}
                    />
                    <Tooltip
                      content={
                        <ScatterTooltip
                          nameA={result.paramA.param_name}
                          unitA={result.paramA.unit}
                          nameB={result.paramB.param_name}
                          unitB={result.paramB.unit}
                        />
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Scatter name="合格" data={qualified} fill="#22c55e" opacity={0.8} />
                    <Scatter name="不合格" data={unqualified} fill="#ef4444" opacity={0.8} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 相关系数卡片 */}
            <Card className={corrInfo ? `border ${corrInfo.bg}` : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">皮尔逊相关系数</CardTitle>
                <CardDescription>衡量两参数线性相关程度</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <div className="text-center">
                  <div className={`text-5xl font-bold tracking-tight ${corrInfo?.color ?? 'text-foreground'}`}>
                    {result.correlation != null ? result.correlation.toFixed(4) : 'N/A'}
                  </div>
                  <div className="mt-2">
                    <Badge className={corrInfo?.badge ?? ''} variant="secondary">
                      {corrInfo?.label ?? '无数据'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-2 w-full space-y-2.5 text-sm text-muted-foreground">
                  {[
                    ['样本数量', String(result.dataPoints.length), 'text-foreground'],
                    ['合格样本', String(qualified.length), 'text-emerald-600'],
                    ['不合格样本', String(unqualified.length), 'text-red-600'],
                    [
                      '合格率',
                      result.dataPoints.length
                        ? `${((qualified.length / result.dataPoints.length) * 100).toFixed(1)}%`
                        : 'N/A',
                      'text-foreground',
                    ],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex justify-between">
                      <span>{label}</span>
                      <span className={`font-medium ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-1 w-full rounded-lg bg-background/60 p-3 text-xs text-muted-foreground">
                  {corrInfo?.label === '无明显相关'
                    ? '两个参数之间没有明显的线性相关关系，变化相互独立。'
                    : `两个参数之间存在${corrInfo?.label}关系，${Math.abs(result.correlation ?? 0) >= 0.8 ? '具有较强的线性关联。' : '存在一定的线性趋势。'}`}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 直方图 */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <HistogramCard
              title={result.paramA.param_name}
              unit={result.paramA.unit}
              param={paramADetail}
              distribution={result.distributionA}
            />
            <HistogramCard
              title={result.paramB.param_name}
              unit={result.paramB.unit}
              param={paramBDetail}
              distribution={result.distributionB}
            />
          </div>

          {/* 统计摘要 */}
          {(statsA || statsB) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">统计摘要</CardTitle>
                <CardDescription>样本均值与标准差（均值 ± 标准差）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">样本数量</p>
                    <p className="mt-1 text-2xl font-bold">{statsA?.n ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      {result.paramA.param_name}
                      {result.paramA.unit ? ` (${result.paramA.unit})` : ''}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {statsA ? `${statsA.mean.toFixed(2)} ± ${statsA.std.toFixed(2)}` : 'N/A'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">均值 ± 标准差</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      {result.paramB.param_name}
                      {result.paramB.unit ? ` (${result.paramB.unit})` : ''}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {statsB ? `${statsB.mean.toFixed(2)} ± ${statsB.std.toFixed(2)}` : 'N/A'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">均值 ± 标准差</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}