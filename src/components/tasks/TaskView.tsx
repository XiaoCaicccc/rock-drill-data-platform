'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus,
  User,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  CircleDot,
  Loader,
  CircleCheck,
  CircleX,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types
interface Task {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  assignee: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

type TaskStatus = '待办' | '进行中' | '已完成' | '已关闭'
type TaskPriority = '高' | '中' | '低'

// Config maps
const PRIORITY_BORDER_COLORS: Record<string, string> = {
  '高': 'border-l-red-500',
  '中': 'border-l-amber-500',
  '低': 'border-l-emerald-500',
}

const PRIORITY_BADGE_COLORS: Record<string, string> = {
  '高': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  '中': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  '低': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  '待办': <CircleDot className="size-4" />,
  '进行中': <Loader className="size-4" />,
  '已完成': <CircleCheck className="size-4" />,
  '已关闭': <CircleX className="size-4" />,
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  '待办': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  '进行中': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  '已完成': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '已关闭': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_ORDER: TaskStatus[] = ['待办', '进行中', '已完成', '已关闭']

const STATUS_TRANSITIONS: Record<string, { label: string; icon: React.ReactNode; target: TaskStatus }[]> = {
  '待办': [
    { label: '标记进行中', icon: <ArrowRight className="size-4" />, target: '进行中' },
    { label: '标记完成', icon: <CircleCheck className="size-4" />, target: '已完成' },
    { label: '关闭', icon: <CircleX className="size-4" />, target: '已关闭' },
  ],
  '进行中': [
    { label: '标记完成', icon: <CircleCheck className="size-4" />, target: '已完成' },
    { label: '重新打开', icon: <RotateCcw className="size-4" />, target: '待办' },
    { label: '关闭', icon: <CircleX className="size-4" />, target: '已关闭' },
  ],
  '已完成': [
    { label: '重新打开', icon: <RotateCcw className="size-4" />, target: '待办' },
    { label: '关闭', icon: <CircleX className="size-4" />, target: '已关闭' },
  ],
  '已关闭': [
    { label: '重新打开', icon: <RotateCcw className="size-4" />, target: '待办' },
  ],
}

const emptyFormData = {
  title: '',
  description: '',
  priority: '中' as TaskPriority,
  assignee: '',
  dueDate: '',
}

export default function TaskView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyFormData)
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tasks')
      const json = await res.json()
      if (json.data) {
        setTasks(json.data)
      }
    } catch {
      toast.error('获取任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const openCreateDialog = () => {
    setEditingTask(null)
    setFormData(emptyFormData)
    setDialogOpen(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority as TaskPriority,
      assignee: task.assignee || '',
      dueDate: task.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('请输入任务标题')
      return
    }

    try {
      setSubmitting(true)
      if (editingTask) {
        const res = await fetch('/api/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTask.id,
            title: formData.title.trim(),
            description: formData.description.trim(),
            priority: formData.priority,
            assignee: formData.assignee.trim() || null,
            dueDate: formData.dueDate ? formData.dueDate : null,
          }),
        })
        const json = await res.json()
        if (json.data) {
          toast.success('任务已更新')
        } else {
          toast.error(json.error || '更新失败')
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title.trim(),
            description: formData.description.trim(),
            priority: formData.priority,
            assignee: formData.assignee.trim() || null,
            dueDate: formData.dueDate ? formData.dueDate : null,
          }),
        })
        const json = await res.json()
        if (json.data) {
          toast.success('任务已创建')
        } else {
          toast.error(json.error || '创建失败')
        }
      }
      setDialogOpen(false)
      setEditingTask(null)
      setFormData(emptyFormData)
      fetchTasks()
    } catch {
      toast.error('操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.data) {
        toast.success(`任务状态已更新为"${status}"`)
        fetchTasks()
      } else {
        toast.error(json.error || '状态更新失败')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('任务已删除')
        fetchTasks()
      } else {
        toast.error(json.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    }
  }

  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false
    return isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))
  }

  // Group tasks by status
  const groupedTasks = STATUS_ORDER.map((status) => {
    const items = tasks.filter((t) => t.status === status)
    return { status, items }
  }).filter((group) => {
    if (statusFilter) return group.status === statusFilter
    return true
  })

  // Stats
  const stats = {
    todo: tasks.filter((t) => t.status === '待办').length,
    inProgress: tasks.filter((t) => t.status === '进行中').length,
    done: tasks.filter((t) => t.status === '已完成').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">部门工作台</h2>
          <p className="text-muted-foreground text-sm mt-1">
            管理部门工作任务，跟踪处理进度
          </p>
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="size-4 mr-2" />
          新建任务
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className="py-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter(statusFilter === '待办' ? '' : '待办')}
        >
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.todo}</div>
                <div className="text-muted-foreground text-xs">待办任务</div>
              </div>
              <div className={`rounded-full p-2 ${statusFilter === '待办' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <CircleDot className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="py-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter(statusFilter === '进行中' ? '' : '进行中')}
        >
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.inProgress}</div>
                <div className="text-muted-foreground text-xs">进行中</div>
              </div>
              <div className={`rounded-full p-2 ${statusFilter === '进行中' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <Loader className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="py-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter(statusFilter === '已完成' ? '' : '已完成')}
        >
          <CardContent className="px-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.done}</div>
                <div className="text-muted-foreground text-xs">已完成</div>
              </div>
              <div className={`rounded-full p-2 ${statusFilter === '已完成' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <CircleCheck className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clear filter button */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setStatusFilter('')}>
            {statusFilter}
            <span className="ml-1 text-xs opacity-60">x</span>
          </Badge>
          <span className="text-muted-foreground text-xs">点击清除筛选</span>
        </div>
      )}

      {/* Task Groups */}
      {loading ? (
        <div className="space-y-6">
          {STATUS_ORDER.slice(0, 3).map((_, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 bg-muted rounded w-16" />
                <div className="h-5 bg-muted rounded w-6" />
              </div>
              <div className="space-y-3">
                {[0, 1].map((j) => (
                  <Card key={j} className="animate-pulse py-3">
                    <CardContent className="px-4">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground text-sm">暂无任务数据</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreateDialog}>
              <Plus className="size-4 mr-1" />
              创建第一个任务
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedTasks.map((group) => (
            <section key={group.status}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {STATUS_ICONS[group.status]}
                  <h3 className="text-base font-semibold">{group.status}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {group.items.length}
                </Badge>
                <Separator className="flex-1" />
              </div>

              {/* Task cards */}
              {group.items.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  当前无{group.status}任务
                </p>
              ) : (
                <div className="space-y-3">
                  {group.items.map((task) => (
                    <Card
                      key={task.id}
                      className={`py-0 gap-0 border-l-4 ${PRIORITY_BORDER_COLORS[task.priority] || ''} transition-shadow hover:shadow-sm`}
                    >
                      <CardContent className="px-4 py-3">
                        {/* Main row */}
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() =>
                              setExpandedTask(expandedTask === task.id ? null : task.id)
                            }
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{task.title}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs ${PRIORITY_BADGE_COLORS[task.priority] || ''}`}
                              >
                                {task.priority}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${STATUS_BADGE_COLORS[task.status] || ''}`}
                              >
                                {task.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                              {task.assignee && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <User className="size-3" />
                                  {task.assignee}
                                </span>
                              )}
                              {task.dueDate && (
                                <span
                                  className={`flex items-center gap-1 text-xs ${
                                    isOverdue(task.dueDate)
                                      ? 'text-red-600 font-medium'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  <Calendar className="size-3" />
                                  {format(parseISO(task.dueDate), 'yyyy-MM-dd')}
                                  {isOverdue(task.dueDate) && (
                                    <span className="text-red-600">(已过期)</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="size-8 p-0">
                                  <MoreVertical className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                {STATUS_TRANSITIONS[task.status]?.map((transition) => (
                                  <DropdownMenuItem
                                    key={transition.target}
                                    onClick={() =>
                                      handleStatusChange(task.id, transition.target)
                                    }
                                  >
                                    {transition.icon}
                                    {transition.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(task)}>
                                  <Pencil className="size-4" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDelete(task.id)}
                                >
                                  <Trash2 className="size-4" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {expandedTask === task.id && task.description && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {task.description}
                            </p>
                            {/* Quick status transition buttons */}
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              {STATUS_TRANSITIONS[task.status]?.map((transition) => (
                                <Button
                                  key={transition.target}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStatusChange(task.id, transition.target)
                                  }}
                                >
                                  {transition.icon}
                                  <span className="ml-1">{transition.label}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Create / Edit Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
            <DialogDescription>
              {editingTask
                ? '修改任务的详细信息。'
                : '创建一个新的部门工作任务。'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">任务标题 *</Label>
              <Input
                id="task-title"
                placeholder="请输入任务标题"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc">任务描述</Label>
              <Textarea
                id="task-desc"
                placeholder="请输入任务详细描述"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-priority">优先级</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData({ ...formData, priority: v as TaskPriority })
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
                <Label htmlFor="task-assignee">负责人</Label>
                <Input
                  id="task-assignee"
                  placeholder="请输入负责人姓名"
                  value={formData.assignee}
                  onChange={(e) =>
                    setFormData({ ...formData, assignee: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">截止日期</Label>
              <Input
                id="task-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false)
                setEditingTask(null)
                setFormData(emptyFormData)
              }}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? '保存中...'
                : editingTask
                  ? '更新任务'
                  : '创建任务'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
