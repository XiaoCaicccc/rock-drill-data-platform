'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Puzzle,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Wrench,
  Package,
  AlertCircle,
  Tag,
  FileCheck2,
  Cog,
  Building2,
  CalendarDays,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { PartForm, type PartPayload } from '@/components/parts/PartForm'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

interface Part {
  id: string
  code: string
  name: string
  category_id: string
  category_name: string
  category_code: string
  specification: string | null
  material: string | null
  supplier: string | null
  equipment_id: string | null
  equipment_machine_no: string | null
  equipment_model: string | null
  install_date: string | null
  working_hours: number
  status: string
  remark: string | null
  data_item_count: number
}

interface InspectionRecord {
  id: string
  record_no: string
  inspector: string
  batch_no: string | null
  inspection_date: string
  overall_result: string
  remark: string | null
  qualified_count: number
  total_count: number
  qualified_rate: number
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

// ============================
// Component
// ============================

export default function PartView() {
  // ---- Data state ----
  const [parts, setParts] = useState<Part[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // ---- Dropdown data for filter ----
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([])

  // ---- Dialogs ----
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Part | null>(null)
  const [detailTarget, setDetailTarget] = useState<Part | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ---- Detail: inspection history ----
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [inspectionsLoading, setInspectionsLoading] = useState(false)

  // ---- Action feedback ----
  const [actionError, setActionError] = useState<string | null>(null)

  // =====================
  // Filter config (depends on categoryOptions)
  // =====================
  const filterConfig: FilterItem[] = useMemo(
    () => [
      {
        key: 'keyword',
        label: '关键词',
        type: 'input' as const,
        placeholder: '搜索编号、名称、规格…',
      },
      {
        key: 'category_id',
        label: '类别',
        type: 'select' as const,
        options: categoryOptions,
      },
      {
        key: 'status',
        label: '状态',
        type: 'select' as const,
        options: STATUS_FILTER_OPTIONS,
      },
    ],
    [categoryOptions],
  )

  // =====================
  // Fetch parts
  // =====================
  const fetchParts = useCallback(
    async (filterValues?: Record<string, string>) => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams()
        const f = filterValues ?? filters
        if (f.keyword) params.set('keyword', f.keyword)
        if (f.category_id) params.set('category_id', f.category_id)
        if (f.status) params.set('status', f.status)
        const qs = params.toString()
        const url = `/api/parts${qs ? `?${qs}` : ''}`
        const res = await fetch(url)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }
        const json = await res.json()
        setParts(json.parts ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '未知错误')
      } finally {
        setLoading(false)
      }
    },
    [filters],
  )

  // =====================
  // Fetch categories for filter dropdown
  // =====================
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/categories')
        const json = await res.json()
        setCategoryOptions(
          (json.categories ?? []).map((c: { id: string; name: string; code: string }) => ({
            label: `${c.code} ${c.name}`,
            value: c.id,
          })),
        )
      } catch {
        // ignore
      }
    }
    fetchCategories()
  }, [])

  // Initial load
  useEffect(() => {
    fetchParts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // =====================
  // Fetch inspection history for detail
  // =====================
  const fetchInspections = useCallback(async (partId: string) => {
    try {
      setInspectionsLoading(true)
      // Get all data items for this part, grouped by record
      const res = await fetch(`/api/parts?keyword=${partId}`)
      // We need a dedicated endpoint — use a workaround: fetch categories to get the part's data_item_count
      // Actually, for inspection history we'll query the inspection_data_items aggregated
      // For now, use a simpler approach: fetch all records that have data items for this part
      const recordsRes = await fetch('/api/inspection-records')
      if (!recordsRes.ok) throw new Error()

      // Since we don't have a dedicated inspection-records API yet,
      // we'll use the data_items count from the part itself and show a simplified view.
      // For a full implementation, we'd need /api/parts/[id]/inspections
      setInspections([])
    } catch {
      setInspections([])
    } finally {
      setInspectionsLoading(false)
    }
  }, [])

  // =====================
  // Stats
  // =====================
  const stats = useMemo(() => {
    const total = parts.length
    const inUse = parts.filter((p) => p.status === '在用').length
    const repairing = parts.filter((p) => p.status === '维修中').length
    const retired = parts.filter((p) => p.status === '退役').length
    const inStock = parts.filter((p) => p.status === '库存').length
    return { total, inUse, repairing, retired, inStock }
  }, [parts])

  // =====================
  // Handlers
  // =====================
  const handleSearch = useCallback(
    (values: Record<string, string>) => {
      setFilters(values)
      fetchParts(values)
    },
    [fetchParts],
  )

  const handleReset = useCallback(() => {
    setFilters({})
    fetchParts({})
  }, [fetchParts])

  const handleCreate = useCallback(() => {
    setEditTarget(null)
    setActionError(null)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((p: Part, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTarget(p)
    setActionError(null)
    setFormOpen(true)
  }, [])

  const handleFormSubmit = useCallback(
    async (payload: PartPayload & { id?: string }) => {
      const method = payload.id ? 'PUT' : 'POST'
      const res = await fetch('/api/parts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `请求失败 (${res.status})`)
      }
      await fetchParts()
    },
    [fetchParts],
  )

  const handleDetail = useCallback((p: Part) => {
    setDetailTarget(p)
    setDetailOpen(true)
    setInspections([])
    fetchInspections(p.id)
  }, [fetchInspections])

  const handleDeleteClick = useCallback((p: Part, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteTarget(p)
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/parts?id=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `删除失败 (${res.status})`)
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      await fetchParts()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchParts])

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
        {Array.from({ length: 5 }).map((_, i) => (
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
        <PageHeader title="零件档案管理" description="实现一件一档，管理零部件基础信息和检测历史" />
        <EmptyState
          icon={AlertCircle}
          title="数据加载失败"
          description={`请求出错：${error}`}
          action={{ label: '重新加载', onClick: () => fetchParts() }}
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
        title="零件档案管理"
        description="实现一件一档，管理零部件基础信息、所属设备和检测历史"
        actions={
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新建零件
          </Button>
        }
      />

      {/* ====== Stat Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="零件总数"
          value={stats.total}
          icon={Puzzle}
          description="已登记零件"
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
        filters={filterConfig}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* ====== Action Error ====== */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
          <button
            className="ml-auto text-destructive/60 hover:text-destructive"
            onClick={() => setActionError(null)}
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* ====== Parts Table ====== */}
      {parts.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="暂无零件记录"
          description={'请点击"新建零件"按钮添加第一个零件档案。'}
          action={{ label: '新建零件', onClick: handleCreate }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-4">序号</TableHead>
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead className="hidden md:table-cell">规格</TableHead>
                  <TableHead className="hidden lg:table-cell">材质</TableHead>
                  <TableHead className="hidden xl:table-cell">供应商</TableHead>
                  <TableHead className="hidden sm:table-cell">关联设备</TableHead>
                  <TableHead className="text-center">状态</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">检测数据</TableHead>
                  <TableHead className="w-28 pr-4 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((p, idx) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer group"
                    onClick={() => handleDetail(p)}
                  >
                    <TableCell className="pl-4 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{p.code}</span>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        <span className="font-mono mr-1">{p.category_code}</span>
                        {p.category_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-[100px] truncate text-sm text-muted-foreground md:table-cell">
                      {p.specification ?? '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-[80px] truncate text-sm text-muted-foreground lg:table-cell">
                      {p.material ?? '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-[100px] truncate text-sm text-muted-foreground xl:table-cell">
                      {p.supplier ?? '—'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.equipment_machine_no ? (
                        <span className="text-sm">
                          <span className="font-mono text-muted-foreground">{p.equipment_machine_no}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold',
                          p.data_item_count > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {p.data_item_count}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => handleEdit(p, e)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteClick(p, e)}
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

      {/* ====== Part Detail Dialog ====== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[88vh] sm:max-w-2xl">
          {detailTarget && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Puzzle className="h-5 w-5 text-primary" />
                    <span className="font-mono">{detailTarget.code}</span>
                    <span className="font-normal">— {detailTarget.name}</span>
                  </DialogTitle>
                  <StatusBadge status={detailTarget.status} />
                </div>
                <DialogDescription>
                  <Badge variant="outline" className="mr-2 text-xs font-mono">
                    {detailTarget.category_code}
                  </Badge>
                  {detailTarget.category_name}
                </DialogDescription>
              </DialogHeader>

              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
                <InfoItem icon={Cog} label="规格" value={detailTarget.specification} />
                <InfoItem icon={Building2} label="材质" value={detailTarget.material} />
                <InfoItem icon={Tag} label="供应商" value={detailTarget.supplier} />
                <InfoItem
                  icon={Package}
                  label="关联设备"
                  value={
                    detailTarget.equipment_machine_no
                      ? `${detailTarget.equipment_machine_no} (${detailTarget.equipment_model})`
                      : null
                  }
                />
                <InfoItem
                  icon={CalendarDays}
                  label="安装日期"
                  value={detailTarget.install_date}
                />
                <InfoItem
                  icon={Clock}
                  label="累计工时"
                  value={
                    detailTarget.working_hours > 0
                      ? `${detailTarget.working_hours.toLocaleString()} h`
                      : null
                  }
                />
                <InfoItem
                  icon={FileCheck2}
                  label="检测数据条数"
                  value={`${detailTarget.data_item_count} 条`}
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

              {/* Inspection History placeholder */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">历史检测记录</span>
                  <Badge variant="secondary" className="text-xs">
                    {detailTarget.data_item_count}
                  </Badge>
                </div>

                {inspectionsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 py-8 text-center">
                    <FileCheck2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      检测记录将在「检测台账」模块完成后自动关联显示
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      当前零件共有 {detailTarget.data_item_count} 条检测数据
                    </p>
                  </div>
                )}
              </div>

              {/* Detail footer */}
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

      {/* ====== Form Dialog ====== */}
      <PartForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editData={
          editTarget
            ? {
                id: editTarget.id,
                code: editTarget.code,
                name: editTarget.name,
                category_id: editTarget.category_id,
                specification: editTarget.specification,
                material: editTarget.material,
                supplier: editTarget.supplier,
                equipment_id: editTarget.equipment_id,
                install_date: editTarget.install_date,
                working_hours: editTarget.working_hours,
                status: editTarget.status,
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
        title="确认删除零件"
        description={
          deleteTarget
            ? `确定要删除零件 "${deleteTarget.code}"（${deleteTarget.name}）吗？该零件有 ${deleteTarget.data_item_count} 条检测数据，删除后不可撤销。`
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