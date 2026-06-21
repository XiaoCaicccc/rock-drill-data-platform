'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Server,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Clock,
  MapPin,
  Wrench,
  Package,
  FileCheck2,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { FilterBar, type FilterItem } from '@/components/common/FilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EquipmentForm, type EquipmentPayload } from '@/components/equipment/EquipmentForm'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

interface Equipment {
  id: string
  machine_no: string
  model: string
  manufacturer: string | null
  production_date: string | null
  status: string
  current_location: string | null
  total_working_hours: number
  remark: string | null
  created_at: string
  updated_at: string
  part_count: number
  inspection_count: number
}

interface EquipmentPart {
  id: string
  code: string
  name: string
  category_name: string
  category_code: string
  specification: string | null
  material: string | null
  supplier: string | null
  install_date: string | null
  working_hours: number
  status: string
  remark: string | null
}

// ============================
// Constants
// ============================

const STATUS_FILTER_OPTIONS = [
  { label: '在用', value: '在用' },
  { label: '维修中', value: '维修中' },
  { label: '退役', value: '退役' },
  { label: '库存', value: '库存' },
]

const FILTER_CONFIG: FilterItem[] = [
  {
    key: 'keyword',
    label: '关键词',
    type: 'input',
    placeholder: '搜索编号、型号、制造商…',
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: STATUS_FILTER_OPTIONS,
  },
]

// ============================
// Component
// ============================

export default function EquipmentView() {
  // ---- Data state ----
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // ---- Dialogs ----
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Equipment | null>(null)
  const [detailTarget, setDetailTarget] = useState<Equipment | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ---- Detail: parts ----
  const [parts, setParts] = useState<EquipmentPart[]>([])
  const [partsLoading, setPartsLoading] = useState(false)

  // ---- Action feedback ----
  const [actionError, setActionError] = useState<string | null>(null)

  // =====================
  // Fetch equipment list
  // =====================
  const fetchEquipment = useCallback(async (filterValues?: Record<string, string>) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      const f = filterValues ?? filters
      if (f.keyword) params.set('keyword', f.keyword)
      if (f.status) params.set('status', f.status)
      const qs = params.toString()
      const url = `/api/equipment${qs ? `?${qs}` : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setEquipment(json.equipment ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchEquipment()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // =====================
  // Fetch parts for detail
  // =====================
  const fetchParts = useCallback(async (equipId: string) => {
    try {
      setPartsLoading(true)
      const res = await fetch(`/api/equipment/${equipId}/parts`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setParts(json.parts ?? [])
    } catch {
      setParts([])
    } finally {
      setPartsLoading(false)
    }
  }, [])

  // =====================
  // Stats
  // =====================
  const stats = useMemo(() => {
    const total = equipment.length
    const inUse = equipment.filter((e) => e.status === '在用').length
    const repairing = equipment.filter((e) => e.status === '维修中').length
    const retired = equipment.filter((e) => e.status === '退役').length
    const inStock = equipment.filter((e) => e.status === '库存').length
    return { total, inUse, repairing, retired, inStock }
  }, [equipment])

  // =====================
  // Handlers
  // =====================
  const handleSearch = useCallback(
    (values: Record<string, string>) => {
      setFilters(values)
      fetchEquipment(values)
    },
    [fetchEquipment],
  )

  const handleReset = useCallback(() => {
    setFilters({})
    fetchEquipment({})
  }, [fetchEquipment])

  // Open create form
  const handleCreate = useCallback(() => {
    setEditTarget(null)
    setActionError(null)
    setFormOpen(true)
  }, [])

  // Open edit form
  const handleEdit = useCallback((eq: Equipment, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTarget(eq)
    setActionError(null)
    setFormOpen(true)
  }, [])

  // Submit form (create or update)
  const handleFormSubmit = useCallback(
    async (payload: EquipmentPayload & { id?: string }) => {
      const method = payload.id ? 'PUT' : 'POST'
      const res = await fetch('/api/equipment', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `请求失败 (${res.status})`)
      }
      await fetchEquipment()
    },
    [fetchEquipment],
  )

  // Open detail
  const handleDetail = useCallback((eq: Equipment) => {
    setDetailTarget(eq)
    setDetailOpen(true)
    setParts([])
    fetchParts(eq.id)
  }, [fetchParts])

  // Open delete confirm
  const handleDeleteClick = useCallback((eq: Equipment, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTarget(eq)
    setDeleteOpen(true)
  }, [])

  // Confirm delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/equipment?id=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `删除失败 (${res.status})`)
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      await fetchEquipment()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchEquipment])

  // =====================
  // Loading skeleton
  // =====================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  // =====================
  // Error state
  // =====================
  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="设备档案管理" description="实现一机一档，管理凿岩机设备台账信息" />
        <EmptyState
          icon={AlertCircle}
          title="数据加载失败"
          description={`请求出错：${error}`}
          action={{ label: '重新加载', onClick: () => fetchEquipment() }}
        />
      </div>
    )
  }

  // =====================
  // Main render
  // =====================
  return (
    <div className="space-y-6 p-6">
      {/* ====== Page Header ====== */}
      <PageHeader
        title="设备档案管理"
        description="实现一机一档，管理凿岩机设备台账、状态追踪和关联零件"
        actions={
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新建设备
          </Button>
        }
      />

      {/* ====== Stat Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="设备总数"
          value={stats.total}
          icon={Server}
          description="已登记设备"
        />
        <StatCard
          title="在用"
          value={stats.inUse}
          icon={Wrench}
          description="正常运行"
          className="border-l-4 border-l-emerald-500"
        />
        <StatCard
          title="维修中"
          value={stats.repairing}
          icon={Wrench}
          description="维修保养"
          className="border-l-4 border-l-orange-500"
        />
        <StatCard
          title="退役"
          value={stats.retired}
          icon={AlertCircle}
          description="已停用"
          className="border-l-4 border-l-slate-400"
        />
        <StatCard
          title="库存"
          value={stats.inStock}
          icon={Package}
          description="待分配"
          className="border-l-4 border-l-blue-500"
        />
      </div>

      {/* ====== Filter Bar ====== */}
      <FilterBar
        filters={FILTER_CONFIG}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* ====== Action Error Toast ====== */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
          <button
            className="ml-auto text-destructive/60 hover:text-destructive"
            onClick={() => setActionError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ====== Equipment Table ====== */}
      {equipment.length === 0 ? (
        <EmptyState
          icon={Server}
          title="暂无设备记录"
          description="请点击"新建设备"按钮添加第一台凿岩机设备档案。"
          action={{ label: '新建设备', onClick: handleCreate }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-4">序号</TableHead>
                  <TableHead>机头编号</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead className="hidden md:table-cell">制造商</TableHead>
                  <TableHead className="hidden lg:table-cell">出厂日期</TableHead>
                  <TableHead className="text-center">状态</TableHead>
                  <TableHead className="hidden xl:table-cell">位置</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">工时</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">零件</TableHead>
                  <TableHead className="text-center hidden md:table-cell">检测</TableHead>
                  <TableHead className="w-28 pr-4 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((eq, idx) => (
                  <TableRow
                    key={eq.id}
                    className="cursor-pointer group"
                    onClick={() => handleDetail(eq)}
                  >
                    <TableCell className="pl-4 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">
                        {eq.machine_no}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{eq.model}</TableCell>
                    <TableCell className="hidden max-w-[160px] truncate text-muted-foreground md:table-cell">
                      {eq.manufacturer ?? '—'}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {eq.production_date ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={eq.status} />
                    </TableCell>
                    <TableCell className="hidden max-w-[140px] truncate text-sm text-muted-foreground xl:table-cell">
                      {eq.current_location ?? '—'}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className="font-mono text-sm">
                        {eq.total_working_hours.toLocaleString()}h
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold',
                          eq.part_count > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {eq.part_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {eq.inspection_count}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => handleEdit(eq, e)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteClick(eq, e)}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ====== Equipment Detail Dialog ====== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] sm:max-w-2xl">
          {detailTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    {detailTarget.machine_no}
                  </DialogTitle>
                  <StatusBadge status={detailTarget.status} />
                </div>
                <DialogDescription>{detailTarget.model}</DialogDescription>
              </DialogHeader>

              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                <InfoItem icon={Server} label="型号" value={detailTarget.model} />
                <InfoItem
                  icon={Wrench}
                  label="制造商"
                  value={detailTarget.manufacturer}
                />
                <InfoItem
                  icon={Clock}
                  label="出厂日期"
                  value={detailTarget.production_date}
                />
                <InfoItem
                  icon={MapPin}
                  label="当前位置"
                  value={detailTarget.current_location}
                />
                <InfoItem
                  icon={Clock}
                  label="累计工时"
                  value={
                    detailTarget.total_working_hours > 0
                      ? `${detailTarget.total_working_hours.toLocaleString()} h`
                      : null
                  }
                />
                <InfoItem
                  icon={Package}
                  label="关联零件"
                  value={`${detailTarget.part_count} 件`}
                />
                <InfoItem
                  icon={FileCheck2}
                  label="检测记录"
                  value={`${detailTarget.inspection_count} 条`}
                />
              </div>

              {/* Remark */}
              {detailTarget.remark && (
                <div className="text-sm">
                  <span className="font-medium text-muted-foreground">备注：</span>
                  {detailTarget.remark}
                </div>
              )}

              <Separator />

              {/* Parts list */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">关联零件列表</span>
                  <Badge variant="secondary" className="text-xs">
                    {detailTarget.part_count}
                  </Badge>
                </div>

                {partsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded" />
                    ))}
                  </div>
                ) : parts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    该设备暂无关联零件
                  </p>
                ) : (
                  <ScrollArea className="max-h-[32vh]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">序号</TableHead>
                          <TableHead>零件编码</TableHead>
                          <TableHead>名称</TableHead>
                          <TableHead className="hidden sm:table-cell">类别</TableHead>
                          <TableHead className="hidden md:table-cell">规格</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">工时</TableHead>
                          <TableHead className="text-center">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parts.map((p, idx) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {p.code}
                            </TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {p.category_code}
                              </Badge>
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {p.category_name}
                              </span>
                            </TableCell>
                            <TableCell className="hidden max-w-[120px] truncate text-xs text-muted-foreground md:table-cell">
                              {p.specification ?? '—'}
                            </TableCell>
                            <TableCell className="text-center font-mono text-xs hidden lg:table-cell">
                              {p.working_hours}h
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge status={p.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </div>

              {/* Detail footer actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailOpen(false)
                    setEditTarget(detailTarget)
                    setFormOpen(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailOpen(false)
                    setDeleteTarget(detailTarget)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== Form Dialog (Create / Edit) ====== */}
      <EquipmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editData={
          editTarget
            ? {
                id: editTarget.id,
                machine_no: editTarget.machine_no,
                model: editTarget.model,
                manufacturer: editTarget.manufacturer,
                production_date: editTarget.production_date,
                status: editTarget.status,
                current_location: editTarget.current_location,
                total_working_hours: editTarget.total_working_hours,
                remark: editTarget.remark,
              }
            : null
        }
        onSubmit={handleFormSubmit}
      />

      {/* ====== Delete Confirm ====== */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除设备"
        description={
          deleteTarget
            ? `确定要删除设备 "${deleteTarget.machine_no}"（${deleteTarget.model}）吗？此操作不可撤销。`
            : ''
        }
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  )
}

// ============================
// InfoItem sub-component
// ============================

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value ?? '—'}</p>
      </div>
    </div>
  )
}