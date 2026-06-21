'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  SlidersHorizontal,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Copy,
  AlertCircle,
  Layers,
  ClipboardList,
  Loader2,
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { TemplateEditor, type ParamItem, type TemplateData } from '@/components/templates/TemplateEditor'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

interface Template {
  id: string
  category_id: string
  category_name: string
  category_code: string
  name: string
  version: number
  item_count: number
  items: ParamItem[]
}

// ============================
// Component
// ============================

export default function TemplateView() {
  // ---- Data state ----
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; code: string; has_template: boolean; template_id?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---- Dialogs ----
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TemplateData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ---- Create new template dialog ----
  const [createOpen, setCreateOpen] = useState(false)
  const [createCategoryId, setCreateCategoryId] = useState('')
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ---- Action feedback ----
  const [actionError, setActionError] = useState<string | null>(null)

  // =====================
  // Fetch
  // =====================
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [tplRes, catRes] = await Promise.all([
        fetch('/api/parameter-templates'),
        fetch('/api/categories'),
      ])
      if (!tplRes.ok) throw new Error(`模板 ${tplRes.status}`)
      if (!catRes.ok) throw new Error(`类别 ${catRes.status}`)
      const tplJson = await tplRes.json()
      const catJson = await catRes.json()

      setTemplates(tplJson.templates ?? [])
      const tplIds = new Set((tplJson.templates ?? []).map((t: { category_id: string }) => t.category_id))
      setCategories(
        (catJson.categories ?? []).map((c: { id: string; name: string; code: string }) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          has_template: tplIds.has(c.id),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // =====================
  // Stats
  // =====================
  const stats = useMemo(() => {
    const totalTemplates = templates.length
    const totalItems = templates.reduce((s, t) => s + t.item_count, 0)
    const categoriesWithTemplate = templates.length
    const categoriesWithout = categories.length - categoriesWithTemplate
    const avgItems = totalTemplates > 0 ? Math.round(totalItems / totalTemplates) : 0
    return { totalTemplates, totalItems, categoriesWithTemplate, categoriesWithout, avgItems }
  }, [templates, categories])

  // =====================
  // Handlers
  // =====================
  const handleEdit = useCallback((tpl: Template) => {
    setEditTarget({
      id: tpl.id,
      category_id: tpl.category_id,
      category_name: tpl.category_name,
      category_code: tpl.category_code,
      name: tpl.name,
      version: tpl.version,
      items: tpl.items,
    })
    setEditorOpen(true)
  }, [])

  const handleSave = useCallback(
    async (templateId: string, name: string, version: number, items: ParamItem[]) => {
      const res = await fetch('/api/parameter-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: templateId, name, version, items }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `保存失败 (${res.status})`)
      }
      await fetchData()
    },
    [fetchData],
  )

  const handleCopyTo = useCallback(
    async (sourceTemplateId: string, targetCategoryId: string, newName: string) => {
      // Fetch source template items
      const tplRes = await fetch('/api/parameter-templates')
      const tplJson = await tplRes.json()
      const source = (tplJson.templates ?? []).find((t: { id: string }) => t.id === sourceTemplateId)
      if (!source) throw new Error('源模板未找到')

      const res = await fetch('/api/parameter-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: targetCategoryId,
          name: newName,
          items: source.items,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `复制失败 (${res.status})`)
      }
      await fetchData()
    },
    [fetchData],
  )

  const handleDeleteClick = useCallback((tpl: Template) => {
    setDeleteTarget(tpl)
    setDeleteOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/parameter-templates?id=${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `删除失败 (${res.status})`)
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      await fetchData()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, fetchData])

  // Create new template
  const handleCreate = useCallback(() => {
    setCreateCategoryId('')
    setCreateName('')
    setCreateError(null)
    setCreateOpen(true)
  }, [])

  const handleCreateConfirm = useCallback(async () => {
    if (!createCategoryId) {
      setCreateError('请选择类别')
      return
    }
    if (!createName.trim()) {
      setCreateError('请输入模板名称')
      return
    }
    try {
      setCreating(true)
      const res = await fetch('/api/parameter-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: createCategoryId,
          name: createName.trim(),
          items: [],
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `创建失败 (${res.status})`)
      }
      setCreateOpen(false)
      await fetchData()
      // Auto-open editor for the new template
      const tplJson = await res.json()
      if (tplJson.template) {
        const t = tplJson.template
        setEditTarget({
          id: t.id,
          category_id: createCategoryId,
          category_name: categories.find((c) => c.id === createCategoryId)?.name ?? '',
          category_code: categories.find((c) => c.id === createCategoryId)?.code ?? '',
          name: t.name,
          version: t.version,
          items: (t.items ?? []).map((item: Record<string, unknown>, idx: number) => ({
            param_name: (item.param_name as string) || '',
            param_code: (item.param_code as string) || '',
            unit: (item.unit as string) || '',
            data_type: (item.data_type as string) || 'number',
            standard_min: item.standard_min != null ? String(item.standard_min) : '',
            standard_max: item.standard_max != null ? String(item.standard_max) : '',
            optimal_min: item.optimal_min != null ? String(item.optimal_min) : '',
            optimal_max: item.optimal_max != null ? String(item.optimal_max) : '',
            sort_order: idx,
            options: (item.options as string) || '',
          })),
        })
        setEditorOpen(true)
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }, [createCategoryId, createName, categories, fetchData])

  // =====================
  // Loading
  // =====================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="检测参数模板" description="按零件类别配置检测参数项" />
        <EmptyState
          icon={AlertCircle}
          title="数据加载失败"
          description={`请求出错：${error}`}
          action={{ label: '重新加载', onClick: () => fetchData() }}
        />
      </div>
    )
  }

  const categoryOptions = categories
    .filter((c) => !c.has_template)
    .map((c) => ({ label: `${c.code} ${c.name}`, value: c.id }))

  return (
    <div className="space-y-6 p-6">
      {/* ====== Page Header ====== */}
      <PageHeader
        title="检测参数模板"
        description="按零件类别配置检测参数项（名称、单位、标准区间、最优区间等），支持拖拽排序和模板复制"
        actions={
          <Button onClick={handleCreate} className="gap-1.5" disabled={categoryOptions.length === 0}>
            <Plus className="h-4 w-4" />
            新建模板
          </Button>
        }
      />

      {/* ====== Stat Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="模板总数"
          value={stats.totalTemplates}
          icon={FileText}
          description={`共 ${categories.length} 个类别`}
        />
        <StatCard
          title="参数项总数"
          value={stats.totalItems}
          icon={ClipboardList}
          description={`平均 ${stats.avgItems} 项/模板`}
        />
        <StatCard
          title="已配置类别"
          value={stats.categoriesWithTemplate}
          icon={Layers}
          description="已关联模板"
          className="border-l-4 border-l-emerald-500"
        />
        <StatCard
          title="未配置类别"
          value={stats.categoriesWithout}
          icon={AlertCircle}
          description="可新建模板"
          className="border-l-4 border-l-orange-500"
        />
      </div>

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

      {/* ====== Template Table ====== */}
      {templates.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="暂无参数模板"
          description="请点击"新建模板"按钮为零件类别创建检测参数配置。"
          action={
            categoryOptions.length > 0
              ? { label: '新建模板', onClick: handleCreate }
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-4">序号</TableHead>
                  <TableHead>类别编码</TableHead>
                  <TableHead>类别名称</TableHead>
                  <TableHead>模板名称</TableHead>
                  <TableHead className="text-center">版本</TableHead>
                  <TableHead className="text-center">参数项数</TableHead>
                  <TableHead className="hidden md:table-cell">参数项概览</TableHead>
                  <TableHead className="w-28 pr-4 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl, idx) => (
                  <TableRow key={tpl.id} className="group">
                    <TableCell className="pl-4 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tpl.category_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{tpl.category_name}</TableCell>
                    <TableCell className="text-sm">{tpl.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-xs">
                        v{tpl.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold',
                          tpl.item_count > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {tpl.item_count}
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {tpl.items.slice(0, 5).map((item, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              item.data_type === 'number'
                                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50/50 text-amber-700',
                            )}
                          >
                            {item.param_name}
                          </Badge>
                        ))}
                        {tpl.items.length > 5 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{tpl.items.length - 5}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(tpl)}
                          title="编辑模板"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(tpl)}
                          title="删除模板"
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

      {/* ====== Template Editor Dialog ====== */}
      <TemplateEditor
        template={editTarget}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        allCategories={categories}
        onSave={handleSave}
        onCopyTo={handleCopyTo}
      />

      {/* ====== Create Template Dialog ====== */}
      {/* Using a simple Dialog approach without additional UI imports */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categoryOptions={categoryOptions}
        categoryId={createCategoryId}
        onCategoryIdChange={setCreateCategoryId}
        name={createName}
        onNameChange={setCreateName}
        error={createError}
        creating={creating}
        onConfirm={handleCreateConfirm}
      />

      {/* ====== Delete Confirm ====== */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="确认删除模板"
        description={
          deleteTarget
            ? `确定要删除"${deleteTarget.category_name}"的模板"${deleteTarget.name}"（v${deleteTarget.version}，${deleteTarget.item_count} 个参数项）吗？`
            : ''
        }
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  )
}

// ============================
// Create Template Dialog (inline)
// ============================

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function CreateTemplateDialog({
  open,
  onOpenChange,
  categoryOptions,
  categoryId,
  onCategoryIdChange,
  name,
  onNameChange,
  error,
  creating,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryOptions: { label: string; value: string }[]
  categoryId: string
  onCategoryIdChange: (id: string) => void
  name: string
  onNameChange: (name: string) => void
  error: string | null
  creating: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建参数模板</DialogTitle>
          <DialogDescription>
            选择一个尚未配置模板的零件类别，创建空白模板后可添加参数项。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>
              零件类别 <span className="text-destructive">*</span>
            </Label>
            <Select value={categoryId} onValueChange={onCategoryIdChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="请选择类别" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">所有类别均已配置模板</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>
              模板名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="如 钻头检测参数"
              className="text-sm"
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={creating || !categoryId} className="gap-1.5">
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            创建并编辑
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}