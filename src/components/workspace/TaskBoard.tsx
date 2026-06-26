'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import {
  ListTodo,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  User,
  X,
  Loader2,
  CheckCircle2,
  CircleDot,
  LayoutList,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string
  title: string
  description: string | null
  priority: string // '高' | '中' | '低'
  status: string   // '待办' | '进行中' | '已完成' | '已关闭'
  assignee: string | null
  due_date: string | null
  task_type: string
  created_at: string
  updated_at: string
}

type TaskStatus = '待办' | '进行中' | '已完成' | '已关闭'
type TaskPriority = '高' | '中' | '低'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS: TaskStatus[] = ['待办', '进行中', '已完成', '已关闭']

const COLUMN_HEADER_COLORS: Record<TaskStatus, string> = {
  '待办': 'bg-slate-100 text-slate-700',
  '进行中': 'bg-orange-100 text-orange-700',
  '已完成': 'bg-emerald-100 text-emerald-700',
  '已关闭': 'bg-gray-100 text-gray-500',
}

const PRIORITY_BORDER: Record<string, string> = {
  '高': 'border-l-red-500',
  '中': 'border-l-amber-500',
  '低': 'border-l-emerald-500',
}

const TASK_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  '常规': 'secondary',
  '检测': 'outline',
  '维修': 'destructive',
  '决议': 'default',
}

/**
 * Restricted linear transitions:
 *   待办 → 进行中 → 已完成 → 已关闭
 *   待办 → 已关闭
 *   进行中 → 已关闭
 */
const NEXT_STATUS_MAP: Record<TaskStatus, TaskStatus | null> = {
  '待办': '进行中',
  '进行中': '已完成',
  '已完成': '已关闭',
  '已关闭': null,
}

const STATUS_TASK_TYPE_COLORS: Record<string, string> = {
  '待办': 'bg-slate-100 text-slate-600 border-slate-200',
  '进行中': 'bg-orange-100 text-orange-700 border-orange-200',
  '已完成': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '已关闭': 'bg-gray-200 text-gray-500 border-gray-300',
}

const emptyFormData = {
  title: '',
  description: '',
  priority: '中' as TaskPriority,
  assignee: '',
  due_date: '',
  task_type: '常规' as string,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskCardSkeleton() {
  return (
    <Card className="border-l-4 border-l-transparent">
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

function ColumnSkeleton() {
  return (
    <div className="min-w-[280px] w-[280px] shrink-0 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <div className="space-y-3">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskBoard
// ---------------------------------------------------------------------------

export default function TaskBoard() {
  // ---- Data state ----
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---- Dialog state ----
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // ---- Delete confirmation ----
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ---- Status transition error ----
  const [transitionError, setTransitionError] = useState<string | null>(null)

  // =========================================================================
  // Data fetching
  // =========================================================================

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const statuses = COLUMNS.join(',')
      const res = await fetch(`/api/tasks?status=${statuses}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || '获取任务失败')
      }
      const json = await res.json()
      setTasks(json.tasks ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '获取任务列表失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // =========================================================================
  // Dialog helpers
  // =========================================================================

  const openCreateDialog = () => {
    setEditingTask(null)
    setFormData(emptyFormData)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority as TaskPriority,
      assignee: task.assignee || '',
      due_date: task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '',
      task_type: task.task_type,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingTask(null)
    setFormData(emptyFormData)
    setFormError(null)
  }

  // =========================================================================
  // Submit (create / update)
  // =========================================================================

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      setFormError('请输入任务标题')
      return
    }

    try {
      setSubmitting(true)
      setFormError(null)

      const body: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        priority: formData.priority,
        assignee: formData.assignee.trim() || null,
        due_date: formData.due_date || null,
        task_type: formData.task_type,
      }

      let res: Response
      if (editingTask) {
        res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTask.id, ...body }),
        })
      } else {
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || '操作失败')
      }

      const json = await res.json()
      if (!json.task) {
        throw new Error('服务器返回数据异常')
      }

      // Optimistically update local state
      if (editingTask) {
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? json.task : t)),
        )
      } else {
        setTasks((prev) => [...prev, json.task])
      }

      closeDialog()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败，请重试'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // =========================================================================
  // Delete
  // =========================================================================

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      const res = await fetch(`/api/tasks?id=${deleteTarget.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || '删除失败')
      }

      const json = await res.json()
      if (!json.success) {
        throw new Error('删除失败')
      }

      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: unknown) {
      // On failure, keep dialog open but show error
      const message = err instanceof Error ? err.message : '删除失败'
      setFormError(message)
    } finally {
      setDeleting(false)
    }
  }

  // =========================================================================
  // Status transition
  // =========================================================================

  const handleStatusTransition = async (task: Task, targetStatus: TaskStatus) => {
    setTransitionError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: targetStatus }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || err.message || '状态更新失败')
      }

      const json = await res.json()
      if (!json.task) {
        throw new Error('服务器返回数据异常')
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? json.task : t)),
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '状态更新失败'
      setTransitionError(message)
    }
  }

  // =========================================================================
  // Computed
  // =========================================================================

  const tasksByStatus = COLUMNS.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }))

  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === '待办').length,
    inProgress: tasks.filter((t) => t.status === '进行中').length,
    done: tasks.filter((t) => t.status === '已完成').length,
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Error bar */}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-red-600 px-4 py-3 text-sm text-white">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-white hover:bg-red-700 hover:text-white"
            onClick={() => setError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Transition error bar */}
      {transitionError && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-red-600 px-4 py-3 text-sm text-white">
          <span>{transitionError}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-white hover:bg-red-700 hover:text-white"
            onClick={() => setTransitionError(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">任务看板</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            拖拽管理任务，跟踪处理进度
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          新建任务
        </Button>
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="全部任务"
          value={stats.total}
          icon={ListTodo}
          description="所有状态任务总计"
        />
        <StatCard
          title="待办"
          value={stats.todo}
          icon={CircleDot}
          description="等待处理"
        />
        <StatCard
          title="进行中"
          value={stats.inProgress}
          icon={Loader2}
          description="正在处理"
        />
        <StatCard
          title="已完成"
          value={stats.done}
          icon={CircleCheck}
          description="已处理完毕"
        />
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((_, i) => (
            <ColumnSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={CircleX}
          title="加载失败"
          description={error}
          action={{ label: '重新加载', onClick: fetchTasks }}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="暂无任务"
          description="点击下方按钮创建第一个任务"
          action={{ label: '新建任务', onClick: openCreateDialog }}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {tasksByStatus.map((col) => (
            <div
              key={col.status}
              className="min-w-[280px] w-[280px] shrink-0 flex flex-col"
            >
              {/* Column header */}
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${COLUMN_HEADER_COLORS[col.status]}`}
                >
                  {col.status}
                </span>
                <Badge variant="secondary" className="h-5 min-w-[20px] justify-center text-xs">
                  {col.items.length}
                </Badge>
              </div>

              {/* Card list */}
              <div className="flex-1 max-h-[calc(100vh-380px)] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {col.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      暂无{col.status}任务
                    </p>
                  </div>
                ) : (
                  col.items.map((task) => {
                    const nextStatus = NEXT_STATUS_MAP[task.status as TaskStatus]
                    const canCloseDirectly =
                      (task.status === '待办' || task.status === '进行中') &&
                      task.status !== '已关闭'

                    return (
                      <Card
                        key={task.id}
                        className={`group relative border-l-4 transition-shadow hover:shadow-md ${PRIORITY_BORDER[task.priority] || 'border-l-slate-300'}`}
                      >
                        <CardContent className="p-4">
                          {/* Title row */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium leading-snug">
                              {task.title}
                            </h4>
                            {/* Hover action buttons */}
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditDialog(task)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteTarget(task)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant={TASK_TYPE_VARIANT[task.task_type] || 'secondary'}
                              className="text-xs"
                            >
                              {task.task_type}
                            </Badge>
                            <StatusBadge
                              status={task.status}
                              colorMap={STATUS_TASK_TYPE_COLORS}
                            />
                          </div>

                          {/* Meta row */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {task.assignee && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {task.assignee}
                              </span>
                            )}
                            {task.due_date && (
                              <span
                                className={`flex items-center gap-1 ${isOverdue(task.due_date) ? 'font-medium text-red-600' : ''}`}
                              >
                                <Clock className="h-3 w-3" />
                                {format(parseISO(task.due_date), 'yyyy-MM-dd')}
                                {isOverdue(task.due_date) && (
                                  <span className="text-red-600">(已过期)</span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Status transition buttons */}
                          {task.status !== '已关闭' && (
                            <div className="mt-3 flex items-center gap-2 border-t pt-2.5">
                              {/* Primary "next" button */}
                              {nextStatus && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() =>
                                    handleStatusTransition(task, nextStatus)
                                  }
                                >
                                  {nextStatus === '进行中' && <ArrowRight className="h-3 w-3" />}
                                  {nextStatus === '已完成' && <CircleCheck className="h-3 w-3" />}
                                  {nextStatus === '已关闭' && <CircleX className="h-3 w-3" />}
                                  {nextStatus}
                                </Button>
                              )}
                              {/* Direct close shortcut for 待办/进行中 (if next is NOT 已关闭) */}
                              {canCloseDirectly && nextStatus !== '已关闭' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-red-600"
                                  onClick={() =>
                                    handleStatusTransition(task, '已关闭')
                                  }
                                >
                                  <CircleX className="h-3 w-3" />
                                  关闭
                                </Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New / Edit Dialog                                                  */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
          </DialogHeader>

          {/* Form error */}
          {formError && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-red-600 px-3 py-2 text-sm text-white">
              <span>{formError}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 text-white hover:bg-red-700 hover:text-white"
                onClick={() => setFormError(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="tb-title">任务标题 *</Label>
              <Input
                id="tb-title"
                placeholder="请输入任务标题"
                value={formData.title}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="tb-desc">任务描述</Label>
              <Textarea
                id="tb-desc"
                placeholder="请输入任务详细描述"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            {/* Priority + Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tb-priority">优先级</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, priority: v as TaskPriority }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="高">高</SelectItem>
                    <SelectItem value="中">中</SelectItem>
                    <SelectItem value="低">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tb-type">任务类型</Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, task_type: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="常规">常规</SelectItem>
                    <SelectItem value="检测">检测</SelectItem>
                    <SelectItem value="维修">维修</SelectItem>
                    <SelectItem value="决议">决议</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assignee + Due date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tb-assignee">负责人</Label>
                <Input
                  id="tb-assignee"
                  placeholder="请输入负责人姓名"
                  value={formData.assignee}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, assignee: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tb-due">截止日期</Label>
                <Input
                  id="tb-due"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, due_date: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? '保存中...' : editingTask ? '更新任务' : '创建任务'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Delete Confirmation Dialog                                          */}
      {/* ----------------------------------------------------------------- */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除任务"
        description={`确定要删除任务「${deleteTarget?.title}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}