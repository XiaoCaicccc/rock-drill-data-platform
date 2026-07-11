'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertCircle, ChevronUp, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { FilterBar, type FilterItem } from '@/components/common/FilterBar'
import { PartForm, type Criticality, type PartPayload, type PartRevisionSummary, type RevisionState } from '@/components/parts/PartForm'

interface Part {
  id: string
  code: string
  name: string
  category_id: string
  category_name: string
  category_code: string
  equipment_id: string | null
  equipment_machine_no: string | null
  install_date: string | null
  working_hours: number
  is_active: boolean
  current_revision: PartRevisionSummary | null
  latest_revision: PartRevisionSummary | null
  data_item_count: number
}

const STATE_LABEL: Record<RevisionState, string> = { draft: '草稿', reviewing: '评审中', released: '已发布', obsolete: '已废止' }
const CRITICALITY_LABEL: Record<Criticality, string> = { normal: '一般', important: '重要', critical: '关键' }
const STATE_CLASS: Record<RevisionState, string> = { draft: 'bg-slate-100 text-slate-700', reviewing: 'bg-amber-100 text-amber-800', released: 'bg-emerald-100 text-emerald-800', obsolete: 'bg-slate-200 text-slate-600' }

export default function PartView() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const [parts, setParts] = useState<Part[]>([])
  const [categories, setCategories] = useState<{ label: string; value: string }[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Part | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<Part | null>(null)

  const filterConfig: FilterItem[] = useMemo(() => [
    { key: 'keyword', label: '关键词', type: 'input', placeholder: '编号、名称、图号或规格' },
    { key: 'category_id', label: '类别', type: 'select', options: categories },
    { key: 'lifecycle_state', label: '版本状态', type: 'select', options: Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label })) },
  ], [categories])

  const fetchParts = useCallback(async (nextFilters?: Record<string, string>) => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      Object.entries(nextFilters ?? filters).forEach(([key, value]) => { if (value) params.set(key, value) })
      const response = await fetch(`/api/parts${params.size ? `?${params}` : ''}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '获取零件失败')
      setParts(body.parts ?? [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取零件失败')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchParts() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch('/api/categories').then((response) => response.json()).then((body) => {
      setCategories((body.categories ?? []).map((category: { id: string; code: string; name: string }) => ({ value: category.id, label: `${category.code} ${category.name}` })))
    }).catch(() => undefined)
  }, [])

  const handleSubmit = useCallback(async (payload: PartPayload, submitForReview: boolean) => {
    if (!editTarget) {
      const response = await fetch('/api/parts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '创建零件失败')
    } else {
      const { revision_id, drawing_no, unit, specification, material, supplier, criticality, key_characteristics, change_summary, remark, ...master } = payload
      const masterResponse = await fetch(`/api/parts/${editTarget.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(master) })
      const masterBody = await masterResponse.json()
      if (!masterResponse.ok) throw new Error(masterBody.error ?? '更新主数据失败')
      if (revision_id && editTarget.latest_revision?.lifecycle_state === 'draft') {
        const revisionResponse = await fetch(`/api/part-revisions/${revision_id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drawing_no, unit, specification, material, supplier, criticality, key_characteristics, change_summary, remark, ...(submitForReview ? { lifecycle_state: 'reviewing' } : {}) }),
        })
        const revisionBody = await revisionResponse.json()
        if (!revisionResponse.ok) throw new Error(revisionBody.error ?? '更新版本失败')
      }
    }
    await fetchParts()
  }, [editTarget, fetchParts])

  const createRevision = useCallback(async (part: Part) => {
    try {
      const response = await fetch(`/api/parts/${part.id}/revisions`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '创建升版草稿失败')
      await fetchParts()
    } catch (revisionError) { setError(revisionError instanceof Error ? revisionError.message : '创建升版草稿失败') }
  }, [fetchParts])

  const release = useCallback(async () => {
    const revision = releaseTarget?.latest_revision
    if (!revision) return
    try {
      const response = await fetch(`/api/part-revisions/${revision.id}/release`, { method: 'POST' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '发布版本失败')
      setReleaseTarget(null)
      await fetchParts()
    } catch (releaseError) { setError(releaseError instanceof Error ? releaseError.message : '发布版本失败') }
  }, [fetchParts, releaseTarget])

  const remove = useCallback(async () => {
    if (!deleteTarget) return
    try {
      const response = await fetch(`/api/parts?id=${deleteTarget.id}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? '删除零件失败')
      setDeleteTarget(null)
      await fetchParts()
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : '删除零件失败') }
  }, [deleteTarget, fetchParts])

  const releasedCount = parts.filter((part) => part.current_revision?.lifecycle_state === 'released').length
  const draftCount = parts.filter((part) => part.latest_revision?.lifecycle_state === 'draft').length

  return <div className="flex flex-col gap-6 p-6">
    <PageHeader title="零件主数据管理" description={`共 ${parts.length} 个零件；已发布 ${releasedCount} 个，草稿 ${draftCount} 个`} actions={<Button onClick={() => { setEditTarget(null); setFormOpen(true) }}><Plus data-icon="inline-start" />新建零件</Button>} />
    <FilterBar filters={filterConfig} onSearch={(values) => { setFilters(values); fetchParts(values) }} onReset={() => { setFilters({}); fetchParts({}) }} />
    {error ? <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="size-4" />{error}</div> : null}
    {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">正在加载零件主数据…</CardContent></Card> : null}
    {!loading && parts.length === 0 ? <EmptyState icon={FilePlus2} title="暂无零件主数据" description="请新建零件并维护其首个版本草稿。" action={{ label: '新建零件', onClick: () => { setEditTarget(null); setFormOpen(true) } }} /> : null}
    {!loading && parts.length > 0 ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>编号</TableHead><TableHead>名称</TableHead><TableHead>类别</TableHead><TableHead>版本</TableHead><TableHead>状态</TableHead><TableHead className="hidden lg:table-cell">图号</TableHead><TableHead className="hidden md:table-cell">单位</TableHead><TableHead className="hidden xl:table-cell">关键性</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{parts.map((part) => {
      const revision = part.latest_revision ?? part.current_revision
      return <TableRow key={part.id}><TableCell className="font-mono font-medium">{part.code}</TableCell><TableCell>{part.name}</TableCell><TableCell><Badge variant="outline">{part.category_code} {part.category_name}</Badge></TableCell><TableCell className="font-mono">{revision?.revision_no ?? '—'}</TableCell><TableCell>{revision ? <Badge className={STATE_CLASS[revision.lifecycle_state]}>{STATE_LABEL[revision.lifecycle_state]}</Badge> : <span className="text-muted-foreground">未发布</span>}</TableCell><TableCell className="hidden lg:table-cell">{revision?.drawing_no ?? '—'}</TableCell><TableCell className="hidden md:table-cell">{revision?.unit ?? '—'}</TableCell><TableCell className="hidden xl:table-cell">{revision ? CRITICALITY_LABEL[revision.criticality] : '—'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="编辑" onClick={() => { setEditTarget(part); setFormOpen(true) }}><Pencil /></Button><Button variant="ghost" size="icon" title="升版" onClick={() => createRevision(part)} disabled={!part.current_revision}><ChevronUp /></Button>{userRole === 'admin' && revision?.lifecycle_state === 'reviewing' ? <Button variant="ghost" size="icon" title="发布" onClick={() => setReleaseTarget(part)}><FilePlus2 /></Button> : null}<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="删除" onClick={() => setDeleteTarget(part)}><Trash2 /></Button></div></TableCell></TableRow>
    })}</TableBody></Table></CardContent></Card> : null}
    <PartForm open={formOpen} onOpenChange={setFormOpen} editData={editTarget} onSubmit={handleSubmit} />
    <ConfirmDialog open={Boolean(releaseTarget)} onOpenChange={(open) => { if (!open) setReleaseTarget(null) }} title="确认发布零件版本" description={releaseTarget?.latest_revision ? `确认发布 ${releaseTarget.code} 的 ${releaseTarget.latest_revision.revision_no} 版吗？发布后将成为当前有效版本，技术字段不可再编辑。` : ''} onConfirm={release} />
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} title="确认删除零件" description={deleteTarget ? `确认删除 ${deleteTarget.code} 吗？存在检测数据的零件无法删除。` : ''} onConfirm={remove} variant="destructive" />
  </div>
}
