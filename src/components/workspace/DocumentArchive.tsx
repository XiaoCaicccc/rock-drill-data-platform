'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatCard } from '@/components/common/StatCard'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import {
  FolderOpen,
  Upload,
  Archive,
  FileText,
  Search,
  Trash2,
  FileUp,
  Folder,
} from 'lucide-react'

/* ================================================================
   Types
   ================================================================ */

interface Document {
  id: string
  title: string
  category: string // '报告' | '纪要' | '标准' | '制度' | '其他'
  file_path: string | null
  related_report_id: string | null
  archived: boolean
  created_at: string
}

type Category = '报告' | '纪要' | '标准' | '制度' | '其他'

/* ================================================================
   Constants
   ================================================================ */

const CATEGORIES: Category[] = ['报告', '纪要', '标准', '制度', '其他']

const CATEGORY_TABS: { label: string; value: '' | Category }[] = [
  { label: '全部', value: '' },
  ...CATEGORIES.map(c => ({ label: c, value: c })),
]

const CATEGORY_BADGE: Record<string, string> = {
  '报告': 'bg-blue-100 text-blue-700 border-blue-200',
  '纪要': 'bg-purple-100 text-purple-700 border-purple-200',
  '标准': 'bg-amber-100 text-amber-700 border-amber-200',
  '制度': 'bg-teal-100 text-teal-700 border-teal-200',
  '其他': 'bg-slate-100 text-slate-700 border-slate-200',
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  '报告': <FileText className="h-4 w-4" />,
  '纪要': <FileText className="h-4 w-4" />,
  '标准': <FileText className="h-4 w-4" />,
  '制度': <Folder className="h-4 w-4" />,
  '其他': <Folder className="h-4 w-4" />,
}

const INITIAL_FORM = {
  title: '',
  category: '' as string,
  related_report_id: '',
}

/* ================================================================
   Helpers
   ================================================================ */

function extractFileName(filePath: string | null): string | null {
  if (!filePath) return null
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || null
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

/* ================================================================
   Component
   ================================================================ */

export default function DocumentArchive() {
  /* ── state ── */
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<'' | Category>('')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  // upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // delete
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [deleting, setDeleting] = useState(false)

  // search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  /* ── fetch documents ── */
  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (activeCategory) qs.set('category', activeCategory)
      if (debouncedKeyword) qs.set('keyword', debouncedKeyword)
      const res = await fetch(`/api/documents?${qs}`)
      const data = await res.json()
      setDocuments(data.documents ?? [])
    } catch {
      setError('加载文档列表失败')
    } finally {
      setLoading(false)
    }
  }, [activeCategory, debouncedKeyword])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  /* ── stats ── */
  const stats = {
    total: documents.length,
    archived: documents.filter(d => d.archived).length,
    unarchived: documents.filter(d => !d.archived).length,
  }

  /* ── grouped by category (for "全部" tab) ── */
  const groupedDocuments = activeCategory
    ? { [activeCategory]: documents }
    : CATEGORIES.reduce<Record<string, Document[]>>((acc, cat) => {
        const items = documents.filter(d => d.category === cat)
        if (items.length > 0) acc[cat] = items
        return acc
      }, {})

  /* ── handlers ── */
  const openUpload = () => {
    setForm(INITIAL_FORM)
    setSelectedFile(null)
    setDragOver(false)
    setUploading(false)
    setActionError(null)
    setUploadOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0] ?? null
    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!form.title.trim()) {
      setActionError('标题不能为空')
      return
    }
    if (!form.category) {
      setActionError('请选择文档分类')
      return
    }

    setUploading(true)
    setActionError(null)
    try {
      const fd = new FormData()
      fd.append('title', form.title.trim())
      fd.append('category', form.category)
      if (form.related_report_id.trim()) {
        fd.append('related_report_id', form.related_report_id.trim())
      }
      if (selectedFile) {
        fd.append('file', selectedFile)
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '上传失败')
      }

      setUploadOpen(false)
      fetchDocuments()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleArchiveToggle = async (doc: Document) => {
    setActionError(null)
    try {
      const res = await fetch('/api/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, archived: !doc.archived }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '操作失败')
      }
      fetchDocuments()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents?id=${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error || '删除失败')
      }
      setDeleteTarget(null)
      fetchDocuments()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  /* ── render ── */
  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">文档归档</h2>
          <p className="text-sm text-muted-foreground">管理报告、纪要、标准和制度等文档的归档</p>
        </div>
        <Button onClick={openUpload} size="sm">
          <Upload className="mr-1.5 h-4 w-4" />
          上传文档
        </Button>
      </div>

      {/* 顶部错误条 */}
      {actionError && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="文档总数" value={stats.total} icon={FolderOpen} />
        <StatCard title="已归档" value={stats.archived} icon={Archive} />
        <StatCard title="未归档" value={stats.unarchived} icon={FileText} />
      </div>

      {/* 搜索栏 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="搜索文档标题..."
          className="pl-9"
        />
      </div>

      {/* 分类筛选 Tab */}
      <div className="flex items-center gap-1">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveCategory(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === tab.value
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
        <div className="space-y-6">
          {CATEGORIES.slice(0, 3).map(cat => (
            <div key={cat} className="space-y-3">
              <Skeleton className="h-5 w-20" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-12" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <EmptyState
          title="加载失败"
          description={error}
          action={{ label: '重新加载', onClick: fetchDocuments }}
        />
      )}

      {/* Empty */}
      {!loading && !error && documents.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="暂无文档"
          description={debouncedKeyword ? `没有匹配"${debouncedKeyword}"的文档` : '点击"上传文档"开始添加'}
          action={
            !debouncedKeyword
              ? { label: '上传文档', onClick: openUpload }
              : undefined
          }
        />
      )}

      {/* 文档列表（按分类分组） */}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([category, docs]) => (
            <div key={category}>
              {/* 分类标题 */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-muted-foreground">
                  {CATEGORY_ICONS[category] ?? <Folder className="h-4 w-4" />}
                </span>
                <h3 className="text-sm font-semibold text-foreground">{category}</h3>
                <Badge variant="secondary" className="text-xs">
                  {docs.length}
                </Badge>
                <Separator className="ml-2 flex-1" />
              </div>

              {/* 文档卡片 */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {docs.map(doc => {
                  const fileName = extractFileName(doc.file_path)
                  return (
                    <Card key={doc.id} className="group transition-shadow hover:shadow-md">
                      <CardContent className="space-y-2.5 p-4">
                        {/* 顶部：分类 + 归档状态 */}
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={CATEGORY_BADGE[doc.category] ?? ''}
                          >
                            {doc.category}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              doc.archived
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }
                          >
                            {doc.archived ? '已归档' : '未归档'}
                          </Badge>
                        </div>

                        {/* 标题 */}
                        <h4 className="text-sm font-semibold leading-snug line-clamp-1">
                          {doc.title}
                        </h4>

                        {/* 文件名 */}
                        {fileName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{fileName}</span>
                          </div>
                        )}

                        {/* 日期 */}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </p>

                        {/* 操作按钮（hover 显示） */}
                        <div className="flex items-center justify-end gap-1 border-t pt-2 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-slate-700"
                            onClick={() => handleArchiveToggle(doc)}
                            title={doc.archived ? '取消归档' : '归档'}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteTarget(doc)}
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 上传文档 Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上传文档</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 标题 */}
            <div className="space-y-1.5">
              <Label>标题 *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="请输入文档标题"
              />
            </div>

            {/* 分类 */}
            <div className="space-y-1.5">
              <Label>分类 *</Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择文档分类" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 关联报告 ID */}
            <div className="space-y-1.5">
              <Label>关联报告 ID</Label>
              <Input
                value={form.related_report_id}
                onChange={e => setForm(f => ({ ...f, related_report_id: e.target.value }))}
                placeholder="可选，输入关联的报告 ID"
              />
            </div>

            {/* 文件上传区域 */}
            <div className="space-y-1.5">
              <Label>文件</Label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : selectedFile
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50'
                }`}
              >
                {selectedFile ? (
                  <>
                    <FileUp className="h-8 w-8 text-emerald-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="mt-1 text-xs text-red-500 hover:text-red-700"
                    >
                      移除文件
                    </button>
                  </>
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-muted-foreground/50" />
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        拖拽文件到此处，或 <span className="font-medium text-primary">点击上传</span>
                      </p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          {/* Dialog 内错误 */}
          {actionError && uploadOpen && (
            <p className="text-sm text-red-600">{actionError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? '上传中...' : '上传'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 删除确认 ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="删除文档"
        description={`确定要删除文档"${deleteTarget?.title}"吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}