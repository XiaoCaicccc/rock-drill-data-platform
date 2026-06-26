'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Users,
  MapPin,
  FileText,
  CheckCircle2,
  ChevronRight,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

interface Resolution {
  id: string
  meeting_id: string
  content: string
  responsible_person: string | null
  due_date: string | null
  status: string
}

interface Meeting {
  id: string
  title: string
  meeting_date: string
  location: string | null
  organizer: string
  participants: string | null
  minutes_content: string | null
  status: string
  created_at: string
  updated_at: string
  resolutions: Resolution[]
}

// ============================
// Constants
// ============================

const MEETING_STATUS_FLOW: Record<string, string> = {
  '待召开': '已召开',
  '已召开': '已完成',
}

const RESOLUTION_STATUS_FLOW: Record<string, { label: string; target: string }[]> = {
  '待执行': [
    { label: '开始执行', target: '执行中' },
    { label: '标记完成', target: '已完成' },
  ],
  '执行中': [
    { label: '标记完成', target: '已完成' },
  ],
}

const emptyMeetingForm = {
  title: '',
  meeting_date: '',
  location: '',
  organizer: '',
  participants: '',
}

const emptyResolutionForm = {
  content: '',
  responsible_person: '',
  due_date: '',
  create_task: false,
}

// ============================
// Component
// ============================

export default function MeetingManager() {
  // ---- Data state ----
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---- Dialogs ----
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null)

  // ---- Form state ----
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm)
  const [submitting, setSubmitting] = useState(false)

  // ---- Detail state ----
  const [minutesContent, setMinutesContent] = useState('')
  const [minutesSaving, setMinutesSaving] = useState(false)
  const [resolutions, setResolutions] = useState<Resolution[]>([])
  const [resolutionsLoading, setResolutionsLoading] = useState(false)
  const [resForm, setResForm] = useState(emptyResolutionForm)
  const [resSubmitting, setResSubmitting] = useState(false)

  // ---- Action error ----
  const [actionError, setActionError] = useState<string | null>(null)

  // ---- Hover tracking ----
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // =====================
  // Fetch meetings
  // =====================
  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/meetings')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setMeetings(json.meetings ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  // =====================
  // Fetch resolutions for a meeting
  // =====================
  const fetchResolutions = useCallback(async (meetingId: string) => {
    try {
      setResolutionsLoading(true)
      const res = await fetch(`/api/meetings/resolutions?meeting_id=${meetingId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setResolutions(json.resolutions ?? [])
    } catch {
      setResolutions([])
    } finally {
      setResolutionsLoading(false)
    }
  }, [])

  // =====================
  // Create meeting
  // =====================
  const handleCreateMeeting = async () => {
    if (!meetingForm.title.trim()) {
      toast.error('请输入会议标题')
      return
    }
    if (!meetingForm.meeting_date) {
      toast.error('请选择会议日期')
      return
    }
    if (!meetingForm.organizer.trim()) {
      toast.error('请输入组织者')
      return
    }

    try {
      setSubmitting(true)
      setActionError(null)
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingForm.title.trim(),
          meeting_date: meetingForm.meeting_date,
          location: meetingForm.location.trim() || null,
          organizer: meetingForm.organizer.trim(),
          participants: meetingForm.participants.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.meeting) {
        toast.success('会议已创建')
        setCreateOpen(false)
        setMeetingForm(emptyMeetingForm)
        await fetchMeetings()
      } else {
        setActionError(json.error || '创建失败')
      }
    } catch {
      setActionError('创建会议失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // =====================
  // Open detail dialog
  // =====================
  const handleOpenDetail = useCallback(
    (meeting: Meeting) => {
      setDetailMeeting(meeting)
      setMinutesContent(meeting.minutes_content ?? '')
      setResolutions(meeting.resolutions ?? [])
      setResForm(emptyResolutionForm)
      setActionError(null)
      setDetailOpen(true)
      fetchResolutions(meeting.id)
    },
    [fetchResolutions],
  )

  // =====================
  // Save minutes
  // =====================
  const handleSaveMinutes = async () => {
    if (!detailMeeting) return
    try {
      setMinutesSaving(true)
      setActionError(null)
      const res = await fetch('/api/meetings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailMeeting.id,
          minutes_content: minutesContent,
        }),
      })
      const json = await res.json()
      if (json.meeting) {
        toast.success('纪要已保存')
        setDetailMeeting(json.meeting)
        await fetchMeetings()
      } else {
        setActionError(json.error || '保存纪要失败')
      }
    } catch {
      setActionError('保存纪要失败，请重试')
    } finally {
      setMinutesSaving(false)
    }
  }

  // =====================
  // Change meeting status
  // =====================
  const handleMeetingStatusChange = async (targetStatus: string) => {
    if (!detailMeeting) return
    try {
      setActionError(null)
      const res = await fetch('/api/meetings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailMeeting.id,
          status: targetStatus,
        }),
      })
      const json = await res.json()
      if (json.meeting) {
        toast.success(`会议状态已更新为「${targetStatus}」`)
        setDetailMeeting(json.meeting)
        await fetchMeetings()
      } else {
        setActionError(json.error || '状态更新失败')
      }
    } catch {
      setActionError('状态更新失败，请重试')
    }
  }

  // =====================
  // Delete meeting
  // =====================
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      setActionError(null)
      const res = await fetch(`/api/meetings?id=${meetingId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `删除失败 (${res.status})`)
      }
      toast.success('会议已删除')
      if (detailOpen && detailMeeting?.id === meetingId) {
        setDetailOpen(false)
        setDetailMeeting(null)
      }
      await fetchMeetings()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  // =====================
  // Add resolution
  // =====================
  const handleAddResolution = async () => {
    if (!detailMeeting) return
    if (!resForm.content.trim()) {
      toast.error('请输入决议内容')
      return
    }
    try {
      setResSubmitting(true)
      setActionError(null)
      const res = await fetch('/api/meetings/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: detailMeeting.id,
          content: resForm.content.trim(),
          responsible_person: resForm.responsible_person.trim() || null,
          due_date: resForm.due_date || null,
          create_task: resForm.create_task,
        }),
      })
      const json = await res.json()
      if (json.resolution) {
        toast.success(resForm.create_task ? '决议已添加，关联任务已生成' : '决议已添加')
        setResForm(emptyResolutionForm)
        await fetchResolutions(detailMeeting.id)
        await fetchMeetings()
      } else {
        setActionError(json.error || '添加决议失败')
      }
    } catch {
      setActionError('添加决议失败，请重试')
    } finally {
      setResSubmitting(false)
    }
  }

  // =====================
  // Change resolution status
  // =====================
  const handleResolutionStatusChange = async (resId: string, targetStatus: string) => {
    try {
      setActionError(null)
      const res = await fetch('/api/meetings/resolutions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resId, status: targetStatus }),
      })
      const json = await res.json()
      if (json.resolution) {
        toast.success(`决议状态已更新为「${targetStatus}」`)
        if (detailMeeting) {
          await fetchResolutions(detailMeeting.id)
        }
        await fetchMeetings()
      } else {
        setActionError(json.error || '状态更新失败')
      }
    } catch {
      setActionError('决议状态更新失败，请重试')
    }
  }

  // =====================
  // Loading skeleton
  // =====================
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // =====================
  // Error state
  // =====================
  if (error) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">会议管理</h2>
          <p className="text-sm text-muted-foreground">管理会议安排、纪要与决议跟踪</p>
        </div>
        <EmptyState
          icon={AlertCircle}
          title="数据加载失败"
          description={`请求出错：${error}`}
          action={{ label: '重新加载', onClick: () => fetchMeetings() }}
        />
      </div>
    )
  }

  // =====================
  // Format meeting date
  // =====================
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'yyyy-MM-dd')
    } catch {
      return dateStr
    }
  }

  // =====================
  // Parse participants
  // =====================
  const parseParticipants = (participants: string | null): string[] => {
    if (!participants) return []
    return participants
      .split(/[,，、;；]/)
      .map((p) => p.trim())
      .filter(Boolean)
  }

  // =====================
  // Main render
  // =====================
  return (
    <div className="space-y-6">
      {/* ====== Header ====== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">会议管理</h2>
          <p className="text-sm text-muted-foreground mt-1">管理会议安排、纪要与决议跟踪</p>
        </div>
        <Button onClick={() => { setMeetingForm(emptyMeetingForm); setActionError(null); setCreateOpen(true) }} className="shrink-0">
          <Plus className="size-4 mr-2" />
          新建会议
        </Button>
      </div>

      {/* ====== Action Error Bar ====== */}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError}
          <button
            className="ml-auto text-red-500/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-300"
            onClick={() => setActionError(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ====== Meeting List ====== */}
      {meetings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="暂无会议记录"
          description={'点击「新建会议」按钮安排第一场会议。'}
          action={{ label: '新建会议', onClick: () => { setMeetingForm(emptyMeetingForm); setActionError(null); setCreateOpen(true) } }}
        />
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const participants = parseParticipants(meeting.participants)
            const nextStatus = MEETING_STATUS_FLOW[meeting.status]

            return (
              <Card
                key={meeting.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleOpenDetail(meeting)}
                onMouseEnter={() => setHoveredId(meeting.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      {/* Title + Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate max-w-xs sm:max-w-md">
                          {meeting.title}
                        </span>
                        <StatusBadge status={meeting.status} />
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          {formatDate(meeting.meeting_date)}
                        </span>
                        {meeting.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {meeting.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="size-3" />
                          {meeting.organizer}
                        </span>
                      </div>

                      {/* Participants badges */}
                      {participants.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                          {participants.slice(0, 8).map((p, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs px-1.5 py-0 h-5 font-normal"
                            >
                              {p}
                            </Badge>
                          ))}
                          {participants.length > 8 && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 h-5 font-normal"
                            >
                              +{participants.length - 8}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: hover actions */}
                    <div
                      className={cn(
                        'flex items-center gap-1 shrink-0 transition-opacity',
                        hoveredId === meeting.id ? 'opacity-100' : 'opacity-0',
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(meeting)
                        }}
                        title="查看详情"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteMeeting(meeting.id)
                        }}
                        title="删除"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <ChevronRight className="size-4 text-muted-foreground ml-1" />
                    </div>
                  </div>

                  {/* Quick status transition */}
                  {nextStatus && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {meeting.resolutions?.length
                          ? `${meeting.resolutions.length} 条决议`
                          : '暂无决议'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMeetingStatusChange(nextStatus)
                        }}
                      >
                        <CheckCircle2 className="size-3" />
                        <span>推进至「{nextStatus}」</span>
                        <ChevronRight className="size-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ====== New Meeting Dialog ====== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建会议</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">会议标题 *</Label>
              <Input
                id="meeting-title"
                placeholder="请输入会议标题"
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meeting-date">会议日期 *</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={meetingForm.meeting_date}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meeting_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting-location">会议地点</Label>
                <Input
                  id="meeting-location"
                  placeholder="请输入地点"
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-organizer">组织者 *</Label>
              <Input
                id="meeting-organizer"
                placeholder="请输入组织者姓名"
                value={meetingForm.organizer}
                onChange={(e) => setMeetingForm({ ...meetingForm, organizer: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-participants">参会人员</Label>
              <Input
                id="meeting-participants"
                placeholder="多人用逗号分隔，如：张三，李四，王五"
                value={meetingForm.participants}
                onChange={(e) => setMeetingForm({ ...meetingForm, participants: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateOpen(false); setMeetingForm(emptyMeetingForm) }}
            >
              取消
            </Button>
            <Button onClick={handleCreateMeeting} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                '创建会议'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Meeting Detail Dialog ====== */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setDetailMeeting(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {detailMeeting && (
            <>
              <DialogHeader className="shrink-0">
                <div className="flex items-center gap-2 pr-8">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <DialogTitle className="flex-1 truncate">{detailMeeting.title}</DialogTitle>
                  <StatusBadge status={detailMeeting.status} />
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pb-4">
                  {/* ---- Meeting Info ---- */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold mb-3">会议信息</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                      <InfoItem
                        icon={CalendarDays}
                        label="会议日期"
                        value={formatDate(detailMeeting.meeting_date)}
                      />
                      <InfoItem
                        icon={MapPin}
                        label="会议地点"
                        value={detailMeeting.location}
                      />
                      <InfoItem
                        icon={Users}
                        label="组织者"
                        value={detailMeeting.organizer}
                      />
                    </div>
                    {parseParticipants(detailMeeting.participants).length > 0 && (
                      <div className="flex items-start gap-2 mt-3">
                        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">参会人员</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {parseParticipants(detailMeeting.participants).map((p, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs px-1.5 py-0 h-5 font-normal"
                              >
                                {p}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status flow buttons */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <span className="text-xs text-muted-foreground mr-1">状态流转：</span>
                      <StatusBadge status={detailMeeting.status} />
                      {MEETING_STATUS_FLOW[detailMeeting.status] && (
                        <>
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 gap-1"
                            onClick={() => handleMeetingStatusChange(MEETING_STATUS_FLOW[detailMeeting.status]!)}
                          >
                            <CheckCircle2 className="size-3" />
                            {MEETING_STATUS_FLOW[detailMeeting.status]}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ---- Minutes Editor ---- */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-semibold">会议纪要</h4>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={handleSaveMinutes}
                        disabled={minutesSaving}
                      >
                        {minutesSaving ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          '保存纪要'
                        )}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="请输入会议纪要内容..."
                      rows={6}
                      className="resize-y"
                      value={minutesContent}
                      onChange={(e) => setMinutesContent(e.target.value)}
                    />
                  </div>

                  <Separator />

                  {/* ---- Resolutions Section ---- */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">决议列表</h4>
                      <Badge variant="secondary" className="text-xs">
                        {resolutions.length}
                      </Badge>
                    </div>

                    {/* Resolution list */}
                    {resolutionsLoading ? (
                      <div className="space-y-2 mb-4">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 rounded-lg" />
                        ))}
                      </div>
                    ) : resolutions.length > 0 ? (
                      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                        {resolutions.map((res) => (
                          <div
                            key={res.id}
                            className="rounded-lg border p-3 text-sm space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="flex-1 text-sm leading-relaxed">{res.content}</p>
                              <StatusBadge status={res.status} className="shrink-0" />
                            </div>
                            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                              {res.responsible_person && (
                                <span className="flex items-center gap-1">
                                  <Users className="size-3" />
                                  {res.responsible_person}
                                </span>
                              )}
                              {res.due_date && (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="size-3" />
                                  {formatDate(res.due_date)}
                                </span>
                              )}
                            </div>
                            {/* Resolution status buttons */}
                            {RESOLUTION_STATUS_FLOW[res.status] && (
                              <div className="flex items-center gap-2 pt-1 border-t">
                                {RESOLUTION_STATUS_FLOW[res.status]!.map((transition) => (
                                  <Button
                                    key={transition.target}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-6"
                                    onClick={() => handleResolutionStatusChange(res.id, transition.target)}
                                  >
                                    {transition.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground mb-4">
                        暂无决议
                      </p>
                    )}

                    {/* Add resolution form */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        添加决议
                      </h5>
                      <div className="space-y-2">
                        <Label htmlFor="res-content" className="text-xs">决议内容 *</Label>
                        <Input
                          id="res-content"
                          placeholder="请输入决议内容"
                          value={resForm.content}
                          onChange={(e) => setResForm({ ...resForm, content: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="res-person" className="text-xs">责任人</Label>
                          <Input
                            id="res-person"
                            placeholder="请输入责任人"
                            value={resForm.responsible_person}
                            onChange={(e) => setResForm({ ...resForm, responsible_person: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="res-date" className="text-xs">截止日期</Label>
                          <Input
                            id="res-date"
                            type="date"
                            value={resForm.due_date}
                            onChange={(e) => setResForm({ ...resForm, due_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={resForm.create_task}
                            onCheckedChange={(checked) =>
                              setResForm({ ...resForm, create_task: checked === true })
                            }
                          />
                          <span className="text-xs text-muted-foreground">生成关联任务</span>
                        </label>
                        <Button
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={handleAddResolution}
                          disabled={resSubmitting}
                        >
                          {resSubmitting ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              添加中...
                            </>
                          ) : (
                            <>
                              <Plus className="size-3" />
                              添加决议
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
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
