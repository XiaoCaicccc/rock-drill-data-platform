'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Upload,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Hash,
  Target,
  Percent,
  Table2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'
import {
  MatrixTable,
  buildCellKey,
  parseCellKey,
  type PartRow,
  type ParamColumn,
} from './MatrixTable'

// ============================
// Types
// ============================

interface EquipmentOption {
  id: string
  machine_no: string
  model: string
  status: string
}

// ============================
// Main Component
// ============================

export default function InspectionEntryView() {
  // --- Equipment ---
  const [equipmentOptions, setEquipmentOptions] = useState<EquipmentOption[]>(
    [],
  )
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [loadingEquipment, setLoadingEquipment] = useState(true)

  // --- Parts & Templates ---
  const [parts, setParts] = useState<PartRow[]>([])
  const [paramColumns, setParamColumns] = useState<ParamColumn[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // --- Cell values ---
  const [cellValues, setCellValues] = useState<Record<string, string>>({})
  const [formKey, setFormKey] = useState(0)

  // --- Batch info ---
  const [inspector, setInspector] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [inspectionDate, setInspectionDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [remark, setRemark] = useState('')

  // --- Submission ---
  const [submitting, setSubmitting] = useState(false)

  // ============================
  // Load equipment list on mount
  // ============================

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadingEquipment(true)
        const res = await fetch('/api/equipment?status=在用')
        const data = await res.json()
        if (!cancelled) {
          setEquipmentOptions(data.equipment || [])
        }
      } catch {
        if (!cancelled) toast.error('获取设备列表失败')
      } finally {
        if (!cancelled) setLoadingEquipment(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ============================
  // Load parts + templates when equipment changes
  // ============================

  useEffect(() => {
    if (!selectedEquipmentId) {
      setParts([])
      setParamColumns([])
      setCellValues({})
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoadingData(true)
        const [partsRes, tplRes] = await Promise.all([
          fetch(`/api/equipment/${selectedEquipmentId}/parts`),
          fetch('/api/parameter-templates'),
        ])
        const partsData = await partsRes.json()
        const tplData = await tplRes.json()

        if (cancelled) return

        // Map API parts to PartRow
        const loadedParts: PartRow[] = (partsData.parts || []).map(
          (p: Record<string, unknown>) => ({
            id: p.id as string,
            code: p.code as string,
            name: p.name as string,
            category_code: (p.category_code as string) || '',
            category_name: (p.category_name as string) || '',
          }),
        )

        // Unique category codes from parts
        const catCodes = [
          ...new Set(loadedParts.map((p) => p.category_code)),
        ]

        // All templates, filtered by category_code
        const templates = (tplData.templates || []) as Array<{
          category_code: string
          items: Array<{
            id: string
            param_name: string
            param_code: string
            unit: string | null
            data_type: string
            standard_min: number | null
            standard_max: number | null
            optimal_min: number | null
            optimal_max: number | null
          }>
        }>

        const columns: ParamColumn[] = []
        for (const tpl of templates) {
          if (!catCodes.includes(tpl.category_code)) continue
          for (const item of tpl.items) {
            columns.push({
              id: item.id,
              param_name: item.param_name,
              param_code: item.param_code,
              unit: item.unit,
              data_type: item.data_type,
              standard_min: item.standard_min,
              standard_max: item.standard_max,
              optimal_min: item.optimal_min,
              optimal_max: item.optimal_max,
              category_code: tpl.category_code,
            })
          }
        }

        setParts(loadedParts)
        setParamColumns(columns)
        setCellValues({})
        setFormKey((k) => k + 1)
      } catch {
        if (!cancelled) toast.error('加载检测数据失败')
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedEquipmentId])

  // ============================
  // Cell change handler
  // ============================

  const handleCellChange = useCallback(
    (partId: string, paramItemId: string, value: string) => {
      const key = buildCellKey(partId, paramItemId)
      setCellValues((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  // ============================
  // Real-time stats
  // ============================

  const stats = useMemo(() => {
    const pMap: Record<string, ParamColumn> = {}
    for (const pc of paramColumns) pMap[pc.id] = pc

    // category_code -> param IDs
    const catP: Record<string, string[]> = {}
    for (const pc of paramColumns) {
      if (!catP[pc.category_code]) catP[pc.category_code] = []
      catP[pc.category_code].push(pc.id)
    }

    // Total applicable cells
    let totalApplicable = 0
    for (const part of parts) {
      totalApplicable += (catP[part.category_code] || []).length
    }

    // Filled & qualified
    let filledCount = 0
    let qualifiedCount = 0

    for (const [key, value] of Object.entries(cellValues)) {
      if (!value.trim()) continue
      filledCount++
      const { paramItemId } = parseCellKey(key)
      const param = pMap[paramItemId]
      if (!param || param.data_type !== 'number') continue
      if (param.standard_min == null || param.standard_max == null) continue
      const num = parseFloat(value)
      if (isNaN(num)) continue
      if (num >= param.standard_min && num <= param.standard_max)
        qualifiedCount++
    }

    const passRate =
      filledCount > 0
        ? Math.round((qualifiedCount / filledCount) * 100)
        : 0

    return { totalApplicable, filledCount, qualifiedCount, passRate }
  }, [parts, paramColumns, cellValues])

  // ============================
  // Template coverage
  // ============================

  const templateCoverage = useMemo(() => {
    if (parts.length === 0) return null
    const catCodes = [...new Set(parts.map((p) => p.category_code))]
    const coveredCodes = [
      ...new Set(paramColumns.map((pc) => pc.category_code)),
    ]
    return {
      total: catCodes.length,
      covered: coveredCodes.length,
      missing: catCodes.filter((c) => !coveredCodes.includes(c)),
    }
  }, [parts, paramColumns])

  // ============================
  // Submit
  // ============================

  async function handleSubmit() {
    if (!selectedEquipmentId) {
      toast.error('请先选择设备')
      return
    }
    if (!inspector.trim()) {
      toast.error('请填写检测人员')
      return
    }
    if (!inspectionDate) {
      toast.error('请选择检测日期')
      return
    }
    if (stats.filledCount === 0) {
      toast.error('请至少填写一个检测数据')
      return
    }

    try {
      setSubmitting(true)

      // Build param map
      const pMap: Record<string, ParamColumn> = {}
      for (const pc of paramColumns) pMap[pc.id] = pc

      // Collect non-empty cells
      const items: Array<{
        part_id: string
        param_item_id: string
        value_number: number | null
        value_text: string | null
      }> = []

      for (const [key, value] of Object.entries(cellValues)) {
        if (!value.trim()) continue
        const { partId, paramItemId } = parseCellKey(key)
        const param = pMap[paramItemId]
        if (!param) continue

        items.push({
          part_id: partId,
          param_item_id: paramItemId,
          value_number:
            param.data_type === 'number' && !isNaN(parseFloat(value))
              ? parseFloat(value)
              : null,
          value_text: param.data_type !== 'number' ? value.trim() : null,
        })
      }

      const res = await fetch('/api/inspections/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            equipment_id: selectedEquipmentId,
            inspector: inspector.trim(),
            batch_no: batchNo.trim() || null,
            inspection_date: inspectionDate,
            remark: remark.trim() || null,
          },
          items,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '提交失败')
        return
      }

      toast.success(data.message || '提交成功')
      setCellValues({})
      setFormKey((k) => k + 1)
      setBatchNo('')
      setRemark('')
    } catch {
      toast.error('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // ============================
  // Clear
  // ============================

  function handleClear() {
    setCellValues({})
    setFormKey((k) => k + 1)
    setInspector('')
    setBatchNo('')
    setRemark('')
    setInspectionDate(new Date().toISOString().slice(0, 10))
  }

  // ============================
  // Render
  // ============================

  return (
    <div className="space-y-6">
      <PageHeader
        title="检测数据录入"
        description="选择设备后，以矩阵表格形式批量录入各零件的检测参数值"
        actions={
          selectedEquipmentId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={submitting}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                清空
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || stats.filledCount === 0}
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1.5 h-4 w-4" />
                )}
                提交检测数据
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ====== Equipment Selection ====== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">选择设备</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">设备</Label>
              {loadingEquipment ? (
                <Skeleton className="h-9 w-[300px]" />
              ) : (
                <Select
                  value={selectedEquipmentId || '__none__'}
                  onValueChange={(v) =>
                    setSelectedEquipmentId(v === '__none__' ? '' : v)
                  }
                >
                  <SelectTrigger className="h-9 w-[300px]">
                    <SelectValue placeholder="请选择要检测的设备" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">请选择设备</SelectItem>
                    {equipmentOptions.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.machine_no} — {eq.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedEquipmentId && !loadingData && (
              <div className="flex flex-wrap items-center gap-2 pb-0.5">
                <Badge variant="secondary">{parts.length} 个零件</Badge>
                <Badge variant="secondary">{paramColumns.length} 个参数</Badge>
                {templateCoverage && templateCoverage.missing.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {templateCoverage.missing.length} 个类别无模板
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ====== Content (after equipment selected) ====== */}
      {selectedEquipmentId && (
        <>
          {/* --- Batch Info --- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">检测信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    检测人员 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                    placeholder="请输入姓名"
                    className="h-9"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    批次号
                  </Label>
                  <Input
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    placeholder={'可选，如 2025-01-第3次'}
                    className="h-9"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    检测日期 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    备注
                  </Label>
                  <Input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="可选备注"
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- Real-time Stats --- */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard title="零件数" value={parts.length} icon={Hash} />
            <StatCard
              title="参数列数"
              value={paramColumns.length}
              icon={Table2}
            />
            <StatCard
              title="已填参数"
              value={stats.filledCount}
              icon={Target}
              description={`/ ${stats.totalApplicable}`}
            />
            <StatCard
              title="预估合格率"
              value={`${stats.passRate}%`}
              icon={Percent}
              description={
                stats.filledCount > 0
                  ? `${stats.qualifiedCount} / ${stats.filledCount}`
                  : undefined
              }
              trend={
                stats.passRate >= 90
                  ? 'up'
                  : stats.passRate >= 70
                    ? 'neutral'
                    : stats.filledCount > 0
                      ? 'down'
                      : undefined
              }
            />
          </div>

          {/* --- Matrix Table --- */}
          {loadingData ? (
            <Card>
              <CardContent className="space-y-3 p-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : parts.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="该设备暂无零件"
              description={'请先在「零件档案」中为该设备添加零件，并确保零件已关联类别。'}
            />
          ) : paramColumns.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="零件类别未配置参数模板"
              description={
                '请先在「参数模板管理」中为相关零件类别创建检测参数模板。'
              }
            />
          ) : (
            <MatrixTable
              parts={parts}
              paramColumns={paramColumns}
              cellValues={cellValues}
              onCellChange={handleCellChange}
              formKey={formKey}
              disabled={submitting}
            />
          )}
        </>
      )}
    </div>
  )
}