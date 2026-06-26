'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import {
  FileBarChart,
  Plus,
  Pencil,
  Send,
  Archive,
  Trash2,
  FileText,
  ClipboardList,
  Target,
  Infinity,
} from 'lucide-react'

/* ================================================================
   Types
   ================================================================ */

interface Report {
  id: string
  report_no: string
  title: string
  type: string
  period: string | null
  summary: string | null
  conclusion: string | null
  author: string
  status: string
  created_at: string
  updated_at: string
}

type TabValue = '' | '草稿' | '已发布' | '已归档'

/* ================================================================
   Constants
   ================================================================ */

const REPORT_TYPES = ['月度', '季度', '专项', '全生命周期'] as const

const TYPE_BADGE: Record<string, string> = {
  '月度': 'bg-blue-100 text-blue-700 border-blue-200',
  '季度': 'bg-purple-100 text-purple-700 border-purple-200',
  '专项': 'bg-amber-100 text-amber-700 border-amber-200',
  '全生命周期': 'bg-teal-100 text-teal-700 border-teal-200',
}

const TABS: { label: string; value: TabValue }[] = [
  { label: '全部', value: '' },
  { label: '草稿', value: '草稿' },
  { label: '已发布', value: '已发布' },
  { label: '已归档', value: '已归档' },
]

const INITIAL_FORM = {
  title: '',
  type: '月度',
  period: '',
  summary: '',
  conclusion: '',
  author: '',
}

/* ================================================================
   Component
   ================================================================ */

export default function ReportView() {
  /* ── state ── */
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabValue>('')

  // dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [formSaving, setFormSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [actionError, setActionError] = useState('')

  /* ── fetch reports ── */
  const fetchReports = async (status?: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (status) qs.set('status', status)
      const res = await fetch(`/api/reports?${qs}`)
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch {
      setError('加载报告列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports(activeTab)
  }, [activeTab])

  /* ── stats ── */
  const stats = {
    total: reports.length,
    draft: reports.filter(r => r.status === '草稿').length,
    published: reports.filter(r => r.status === '已发布').length,
    archived: reports.filter(r => r.status === '已归档').length,
  }

  /* ── filtered by tab (already server-side, but for "all" we show everything) ── */
  const displayReports = reports

  /* ── handlers ── */
  const openCreate = () => {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setFormOpen(true)
    setActionError('')
  }

  const openEdit = (r: Report) => {
    setEditingId(r.id)
    setForm({
      title: r.title,
      type: r.type,
      period: r.period ?? '',
      summary: r.summary ?? '',
      conclusion: r.conclusion ?? '',
      author: r.author,
    })
    setFormOpen(true)
    setActionError('')
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.type) {
      setActionError('标题和类型不能为空')
      return
    }

    setFormSaving(true)
    setActionError('')
    try {
      const body = { ...form }
      let res: Response

      if (editingId) {
        body.id = editingId
        res = await fetch('/api/reports', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '操作失败')
      }

      setFormOpen(false)
      fetchReports(activeTab)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setFormSaving(false)
    }
  }

  const handleStatusChange = async (r: Report, newStatus: string) => {
    setActionError('')
    try {
      const res = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '状态变更失败')
      }
      fetchReports(activeTab)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/reports?id=${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '删除失败')
      }
      setDeleteTarget(null)
      fetchReports(activeTab)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (iso: string) => iso.slice(0, 10)

  /* ── render ── */
  return (
    <div className="space-y-6">
      <PageHeader
        title="分析报告管理"
        description="编制月度、季度、专项、全生命周期分析报告，管理起草、发布和归档流程"
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            新建报告
          </Button>
        }
      />

      {/* 顶部错误条 */}
      {actionError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* StatCards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="报告总数" value={stats.total} icon={FileText} />
        <StatCard title="草稿" value={stats.draft} icon={ClipboardList} />
        <StatCard title="已发布" value={stats.published} icon={Send} />
        <StatCard title="已归档" value={stats.archived} icon={Archive} />
      </div>

      {/* Tab 筛选 */}
      <div className="flex items-center gap-1">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex justify-between pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <EmptyState
          title="加载失败"
          description={error}
          action={{ label: '重新加载', onClick: () => fetchReports(activeTab) }}
        />
      )}

      {/* Empty */}
      {!loading && !error && displayReports.length === 0 && (
        <EmptyState
          icon={FileBarChart}
          title="暂无报告"
          description={activeTab ? `没有${activeTab}状态的报告` : '点击"新建报告"开始创建'}
          action={
            !activeTab
              ? { label: '新建报告', onClick: openCreate }
              : undefined
          }
        />
      )}

      {/* 报告卡片列表 */}
      {!loading && !error && displayReports.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayReports.map(r => (
            <Card key={r.id} className="group transition-shadow hover:shadow-md">
              <CardContent className="space-y-3 pt-6">
                {/* 顶部：类型 + 状态 */}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={TYPE_BADGE[r.type] ?? ''}
                  >
                    {r.type}
                  </Badge>
                  <StatusBadge status={r.status} />
                </div>

                {/* 编号 */}
                <p className="font-mono text-xs text-muted-foreground">
                  {r.report_no}
                </p>

                {/* 标题 */}
                <h3 className="text-base font-semibold leading-snug line-clamp-1">
                  {r.title}
                </h3>

                {/* 摘要 */}
                {r.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {r.summary}
                  </p>
                )}

                {/* 周期 */}
                {r.period && (
                  <p className="text-xs text-muted-foreground">
                    周期：{r.period}
                  </p>
                )}

                {/* 底部：编制人 + 日期 + 操作 */}
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{r.author || '—'}</div>
                    <div>{formatDate(r.created_at)}</div>
                  </div>

                  {/* 操作按钮（hover 显示） */}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {/* 编辑（草稿/已发布可编辑） */}
                    {(r.status === '草稿' || r.status === '已发布') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(r)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* 发布（仅草稿） */}
                    {r.status === '草稿' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                        onClick={() => handleStatusChange(r, '已发布')}
                        title="发布"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* 归档（仅已发布） */}
                    {r.status === '已发布' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-700"
                        onClick={() => handleStatusChange(r, '已归档')}
                        title="归档"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* 删除（仅草稿） */}
                    {r.status === '草稿' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteTarget(r)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── 新建/编辑 Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑报告' : '新建报告'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 标题 */}
            <div className="space-y-1.5">
              <Label>标题 *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="请输入报告标题"
              />
            </div>

            {/* 类型 + 周期 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>类型 *</Label>
                <Select
                  value={form.type}
                  onValueChange={v => setForm(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>周期</Label>
                <Input
                  value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  placeholder="如：2025年1月"
                />
              </div>
            </div>

            {/* 摘要 */}
            <div className="space-y-1.5">
              <Label>摘要</Label>
              <Textarea
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="报告摘要内容"
                rows={3}
              />
            </div>

            {/* 结论 */}
            <div className="space-y-1.5">
              <Label>结论</Label>
              <Textarea
                value={form.conclusion}
                onChange={e => setForm(f => ({ ...f, conclusion: e.target.value }))}
                placeholder="报告结论"
                rows={3}
              />
            </div>

            {/* 编制人 */}
            <div className="space-y-1.5">
              <Label>编制人</Label>
              <Input
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="编制人姓名"
              />
            </div>
          </div>

          {/* 表单内错误 */}
          {actionError && formOpen && (
            <p className="text-sm text-red-600">{actionError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={formSaving}>
              {formSaving ? '保存中...' : editingId ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 删除确认 ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="删除报告"
        description={`确定要删除报告"${deleteTarget?.title}"吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}