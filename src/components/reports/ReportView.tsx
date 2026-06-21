'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus,
  FileBarChart,
  Pencil,
  Trash2,
  Send,
  Archive,
  Eye,
  X,
  ChevronDown,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
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

// Types
interface Report {
  id: string
  title: string
  reportNo: string
  type: string
  period: string | null
  status: string
  summary: string | null
  conclusion: string | null
  author: string
  createdAt: string
  updatedAt: string
}

type ReportType = '月度分析' | '季度分析' | '专项分析' | '全生命周期'
type ReportStatus = '草稿' | '已发布' | '已归档'

// Color maps
const TYPE_BADGE_COLORS: Record<string, string> = {
  '月度分析': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  '季度分析': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  '专项分析': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  '全生命周期': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

const STATUS_VARIANTS: Record<string, 'outline' | 'default' | 'secondary'> = {
  '草稿': 'outline',
  '已发布': 'default',
  '已归档': 'secondary',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  '草稿': '',
  '已发布': 'bg-emerald-600 hover:bg-emerald-600',
  '已归档': '',
}

const FILTER_TABS = [
  { label: '全部', value: '' },
  { label: '月度分析', value: '月度分析' },
  { label: '季度分析', value: '季度分析' },
  { label: '专项分析', value: '专项分析' },
  { label: '全生命周期', value: '全生命周期' },
]

const TYPE_OPTIONS: ReportType[] = ['月度分析', '季度分析', '专项分析', '全生命周期']

const emptyFormData = {
  title: '',
  type: '专项分析' as ReportType,
  period: '',
  summary: '',
  conclusion: '',
  author: '',
}

export default function ReportView() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [submitting, setSubmitting] = useState(false)

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType) params.set('type', filterType)
      if (filterStatus) params.set('status', filterStatus)

      const res = await fetch(`/api/reports${params.toString() ? '?' + params.toString() : ''}`)
      const json = await res.json()
      if (json.data) {
        setReports(json.data)
      }
    } catch {
      toast.error('获取报告列表失败')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const openCreateDialog = () => {
    setEditingReport(null)
    setFormData(emptyFormData)
    setDialogOpen(true)
  }

  const openEditDialog = (report: Report) => {
    setEditingReport(report)
    setFormData({
      title: report.title,
      type: report.type as ReportType,
      period: report.period || '',
      summary: report.summary || '',
      conclusion: report.conclusion || '',
      author: report.author,
    })
    setDialogOpen(true)
  }

  const openDetailDialog = (report: Report) => {
    setSelectedReport(report)
    setDetailOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入报告标题')
      return
    }
    if (!formData.author.trim()) {
      toast.error('请输入编制人')
      return
    }

    try {
      setSubmitting(true)
      if (editingReport) {
        const res = await fetch('/api/reports', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingReport.id,
            title: formData.title.trim(),
            type: formData.type,
            period: formData.period.trim(),
            summary: formData.summary.trim(),
            conclusion: formData.conclusion.trim(),
            author: formData.author.trim(),
          }),
        })
        const json = await res.json()
        if (json.data) {
          toast.success('报告已更新')
        } else {
          toast.error(json.error || '更新失败')
        }
      } else {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title.trim(),
            type: formData.type,
            period: formData.period.trim(),
            summary: formData.summary.trim(),
            conclusion: formData.conclusion.trim(),
            author: formData.author.trim(),
          }),
        })
        const json = await res.json()
        if (json.data) {
          toast.success('报告已创建')
        } else {
          toast.error(json.error || '创建失败')
        }
      }
      setDialogOpen(false)
      setEditingReport(null)
      setFormData(emptyFormData)
      fetchReports()
    } catch {
      toast.error('操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: string, status: ReportStatus) => {
    try {
      const res = await fetch('/api/reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.data) {
        const statusLabel = status === '已发布' ? '发布' : '归档'
        toast.success(`报告已${statusLabel}`)
        fetchReports()
      } else {
        toast.error(json.error || '状态更新失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('报告已删除')
        fetchReports()
      } else {
        toast.error(json.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  const statusCounts = {
    total: reports.length,
    draft: reports.filter((r) => r.status === '草稿').length,
    published: reports.filter((r) => r.status === '已发布').length,
    archived: reports.filter((r) => r.status === '已归档').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">分析报告管理</h2>
          <p className="text-muted-foreground text-sm mt-1">
            管理所有质量分析报告，支持月度、季度、专项和全生命周期分析
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="size-4 mr-2" />
          新建报告
        </Button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold">{statusCounts.total}</div>
            <div className="text-muted-foreground text-xs">全部报告</div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold">{statusCounts.draft}</div>
            <div className="text-muted-foreground text-xs">草稿</div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold">{statusCounts.published}</div>
            <div className="text-muted-foreground text-xs">已发布</div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="text-2xl font-bold">{statusCounts.archived}</div>
            <div className="text-muted-foreground text-xs">已归档</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs + status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={filterType === tab.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">状态:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-8 text-sm" size="sm">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              <SelectItem value="草稿">草稿</SelectItem>
              <SelectItem value="已发布">已发布</SelectItem>
              <SelectItem value="已归档">已归档</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-6 bg-muted rounded w-3/4 mt-2" />
                <div className="h-3 bg-muted rounded w-40 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full mt-2" />
                <div className="h-3 bg-muted rounded w-5/6 mt-2" />
                <div className="h-3 bg-muted rounded w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileBarChart className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground text-sm">暂无报告数据</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreateDialog}>
              <Plus className="size-4 mr-1" />
              创建第一份报告
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="group hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={TYPE_BADGE_COLORS[report.type] || ''}
                  >
                    {report.type}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[report.status] || 'outline'}>
                    {report.status}
                  </Badge>
                </div>
                <CardTitle
                  className="text-lg cursor-pointer hover:underline"
                  onClick={() => openDetailDialog(report)}
                >
                  {report.title}
                </CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{report.reportNo}</p>
                {report.period && (
                  <p className="text-sm text-muted-foreground">
                    分析周期: {report.period}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-2">
                {report.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {report.summary}
                  </p>
                )}
                {report.conclusion && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">结论:</span>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                      {report.conclusion}
                    </p>
                  </div>
                )}
              </CardContent>

              <Separator />

              <CardFooter className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span>{report.author}</span>
                  <span className="mx-2">|</span>
                  <span>{format(new Date(report.createdAt), 'yyyy-MM-dd')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => openDetailDialog(report)}
                    title="查看详情"
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0"
                    onClick={() => openEditDialog(report)}
                    title="编辑"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {report.status === '草稿' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => handleStatusChange(report.id, '已发布')}
                      title="发布"
                    >
                      <Send className="size-4" />
                    </Button>
                  )}
                  {report.status === '已发布' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => handleStatusChange(report.id, '已归档')}
                      title="归档"
                    >
                      <Archive className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(report.id)}
                    title="删除"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReport ? '编辑报告' : '新建报告'}</DialogTitle>
            <DialogDescription>
              {editingReport
                ? '修改分析报告的基本信息和内容。'
                : '填写分析报告的基本信息和内容。'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-title">报告标题 *</Label>
              <Input
                id="report-title"
                placeholder="请输入报告标题"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-type">报告类型</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, type: v as ReportType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择报告类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-period">分析周期</Label>
                <Input
                  id="report-period"
                  placeholder="例如: 2025年6月"
                  value={formData.period}
                  onChange={(e) =>
                    setFormData({ ...formData, period: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-summary">报告摘要</Label>
              <Textarea
                id="report-summary"
                placeholder="请输入报告摘要内容"
                rows={4}
                value={formData.summary}
                onChange={(e) =>
                  setFormData({ ...formData, summary: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-conclusion">结论建议</Label>
              <Textarea
                id="report-conclusion"
                placeholder="请输入结论与建议内容"
                rows={4}
                value={formData.conclusion}
                onChange={(e) =>
                  setFormData({ ...formData, conclusion: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-author">编制人 *</Label>
              <Input
                id="report-author"
                placeholder="请输入编制人姓名"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setEditingReport(null)
                setFormData(emptyFormData)
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={TYPE_BADGE_COLORS[selectedReport.type] || ''}
                  >
                    {selectedReport.type}
                  </Badge>
                  <Badge
                    variant={STATUS_VARIANTS[selectedReport.status] || 'outline'}
                    className={STATUS_BADGE_COLORS[selectedReport.status] || ''}
                  >
                    {selectedReport.status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{selectedReport.title}</DialogTitle>
                <DialogDescription className="font-mono">
                  {selectedReport.reportNo}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-2">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">分析周期</span>
                    <p className="text-sm mt-1">{selectedReport.period || '--'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">编制人</span>
                    <p className="text-sm mt-1">{selectedReport.author}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">创建日期</span>
                    <p className="text-sm mt-1">
                      {format(new Date(selectedReport.createdAt), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">报告摘要</h4>
                  <div className="rounded-md bg-muted/50 p-4">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedReport.summary || '暂无摘要'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">结论与建议</h4>
                  <div className="rounded-md bg-muted/50 p-4">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedReport.conclusion || '暂无结论'}
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedReport.status === '草稿' && (
                  <Button
                    onClick={() => {
                      handleStatusChange(selectedReport.id, '已发布')
                      setDetailOpen(false)
                    }}
                  >
                    <Send className="size-4 mr-2" />
                    发布报告
                  </Button>
                )}
                {selectedReport.status === '已发布' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      handleStatusChange(selectedReport.id, '已归档')
                      setDetailOpen(false)
                    }}
                  >
                    <Archive className="size-4 mr-2" />
                    归档报告
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setDetailOpen(false)
                    openEditDialog(selectedReport)
                  }}
                >
                  <Pencil className="size-4 mr-2" />
                  编辑
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
