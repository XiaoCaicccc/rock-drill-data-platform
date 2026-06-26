'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Clock,
  AlertTriangle,
  Plane,
  Users,
  X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/common/StatCard'
import { EmptyState } from '@/components/common/EmptyState'

interface AttendanceRecord {
  id: string
  date: string
  member_name: string
  status: string
  remark: string | null
}

interface MonthlyStats {
  name: string
  attend: number
  leave: number
  late: number
  trip: number
}

interface AttendanceResponse {
  records: AttendanceRecord[]
  memberNames: string[]
  daysInMonth: number
  stats: MonthlyStats[]
  year: number
  month: number
}

const STATUS_OPTIONS = ['出勤', '请假', '迟到', '出差'] as const

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  出勤: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
  请假: { text: 'text-amber-600', bg: 'bg-amber-50' },
  迟到: { text: 'text-red-600', bg: 'bg-red-50' },
  出差: { text: 'text-blue-600', bg: 'bg-blue-50' },
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const getDayOfWeek = (year: number, month: number, day: number) => {
  return new Date(year, month - 1, day).getDay()
}

const isWeekend = (year: number, month: number, day: number) => {
  const dow = getDayOfWeek(year, month, day)
  return dow === 0 || dow === 6
}

const formatDate = (year: number, month: number, day: number) => {
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

type ActiveCell = {
  memberName: string
  day: number
} | null

export default function AttendanceHelper() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<AttendanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<ActiveCell>(null)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/attendance?year=${y}&month=${m}`)
      if (!res.ok) throw new Error(`请求失败 (${res.status})`)
      const json: AttendanceResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(year, month)
  }, [year, month, fetchData])

  const handlePrevMonth = () => {
    setActiveCell(null)
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    setActiveCell(null)
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const getRecord = (memberName: string, day: number): AttendanceRecord | undefined => {
    if (!data) return undefined
    const dateStr = formatDate(year, month, day)
    return data.records.find(
      (r) => r.member_name === memberName && r.date === dateStr
    )
  }

  const handleCellClick = (memberName: string, day: number) => {
    setActiveCell((prev) => {
      if (prev && prev.memberName === memberName && prev.day === day) {
        return null
      }
      return { memberName, day }
    })
  }

  const handleStatusChange = (newStatus: string) => {
    if (!activeCell || !data) return

    const { memberName, day } = activeCell
    const existing = getRecord(memberName, day)

    const pendingSave = async () => {
      setSaving(true)
      try {
        if (existing) {
          const res = await fetch('/api/attendance', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: existing.id,
              status: newStatus,
              remark: existing.remark,
            }),
          })
          if (!res.ok) throw new Error('更新失败')
        } else {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: [
                {
                  date: formatDate(year, month, day),
                  member_name: memberName,
                  status: newStatus,
                },
              ],
            }),
          })
          if (!res.ok) throw new Error('保存失败')
        }
        await fetchData(year, month)
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存失败')
      } finally {
        setSaving(false)
      }
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = setTimeout(pendingSave, 300)

    setActiveCell(null)
  }

  // Close active cell on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        activeCell &&
        tableContainerRef.current &&
        !tableContainerRef.current.contains(target)
      ) {
        setActiveCell(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeCell])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  const totalAttend = data?.stats.reduce((sum, s) => sum + s.attend, 0) ?? 0
  const totalLeave = data?.stats.reduce((sum, s) => sum + s.leave, 0) ?? 0
  const totalLate = data?.stats.reduce((sum, s) => sum + s.late, 0) ?? 0
  const totalTrip = data?.stats.reduce((sum, s) => sum + s.trip, 0) ?? 0

  return (
    <div className="w-full space-y-6">
      {/* Error Bar */}
      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-600 px-4 py-3 text-sm text-white">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 rounded p-0.5 hover:bg-red-700 transition-colors"
            aria-label="关闭错误提示"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold tracking-tight">考勤管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="上个月">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium">
            {year}年{month}月
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="下个月">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="全勤人数"
          value={String(
            data?.stats.filter((s) => s.attend === data?.daysInMonth).length ?? 0
          )}
          icon={UserCheck}
          description={`${totalAttend} 人次出勤`}
        />
        <StatCard
          title="请假人次"
          value={String(totalLeave)}
          icon={Clock}
          description={`共 ${data?.stats.length ?? 0} 名成员`}
        />
        <StatCard
          title="迟到人次"
          value={String(totalLate)}
          icon={AlertTriangle}
          description={totalLate > 0 ? '需要关注' : '表现良好'}
        />
        <StatCard
          title="出差人次"
          value={String(totalTrip)}
          icon={Plane}
          description={`${totalTrip} 次出差记录`}
        />
      </div>

      {/* Attendance Table */}
      <Card>
        <CardContent className="p-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-24 shrink-0" />
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 w-12 shrink-0" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {!loading && (!data || data.memberNames.length === 0) && (
            <EmptyState
              icon={Users}
              title="暂无考勤数据"
              description="请添加成员后开始记录考勤"
            />
          )}

          {!loading && data && data.memberNames.length > 0 && (
            <div ref={tableContainerRef} className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="sticky left-0 z-10 min-w-[100px] bg-background font-semibold"
                    >
                      成员
                    </TableHead>
                    {Array.from({ length: data.daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const weekend = isWeekend(year, month, day)
                      const dow = getDayOfWeek(year, month, day)
                      return (
                        <TableHead
                          key={day}
                          className={`min-w-[52px] text-center text-xs ${
                            weekend ? 'bg-slate-50 text-slate-400' : ''
                          }`}
                        >
                          <div>{day}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {WEEKDAY_LABELS[dow]}
                          </div>
                        </TableHead>
                      )
                    })}
                    <TableHead className="min-w-[60px] text-center font-semibold">
                      出勤天数
                    </TableHead>
                    <TableHead className="min-w-[60px] text-center font-semibold">
                      请假天数
                    </TableHead>
                    <TableHead className="min-w-[60px] text-center font-semibold">
                      迟到天数
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.memberNames.map((name) => {
                    const stat = data.stats.find((s) => s.name === name)
                    return (
                      <TableRow key={name}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {name}
                        </TableCell>
                        {Array.from({ length: data.daysInMonth }).map((_, i) => {
                          const day = i + 1
                          const weekend = isWeekend(year, month, day)
                          const record = getRecord(name, day)
                          const isActive =
                            activeCell?.memberName === name && activeCell?.day === day
                          const style = record ? STATUS_STYLES[record.status] : null

                          return (
                            <TableCell
                              key={day}
                              className={`relative p-0 text-center ${
                                weekend ? 'bg-slate-50' : ''
                              }`}
                            >
                              {isActive ? (
                                <div className="px-0.5 py-0.5">
                                  <Select
                                    onValueChange={handleStatusChange}
                                    defaultValue={record?.status}
                                  >
                                    <SelectTrigger className="h-7 w-full border-primary/50 text-xs">
                                      <SelectValue placeholder="选择状态" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt} value={opt} className="text-xs">
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleCellClick(name, day)}
                                  className={`flex h-full min-h-[32px] w-full cursor-pointer items-center justify-center text-xs transition-colors hover:bg-accent/50 ${
                                    style ? `${style.text} ${style.bg}` : ''
                                  }`}
                                  disabled={saving}
                                  aria-label={`${name} ${month}月${day}日 ${record?.status ?? '未记录'}`}
                                >
                                  {record?.status ?? ''}
                                </button>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center text-sm font-medium">
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                            {stat?.attend ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                            {stat?.leave ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          <Badge variant="secondary" className="bg-red-50 text-red-700">
                            {stat?.late ?? 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* Bottom Totals Row */}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell className="sticky left-0 z-10 bg-muted/50 text-sm">
                      合计
                    </TableCell>
                    {Array.from({ length: data.daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const weekend = isWeekend(year, month, day)
                      const dateStr = formatDate(year, month, day)
                      const dayRecords = data.records.filter((r) => r.date === dateStr)
                      const attendCount = dayRecords.filter((r) => r.status === '出勤').length
                      const lateCount = dayRecords.filter((r) => r.status === '迟到').length
                      const leaveCount = dayRecords.filter((r) => r.status === '请假').length
                      const tripCount = dayRecords.filter((r) => r.status === '出差').length
                      const hasAny = dayRecords.length > 0

                      return (
                        <TableCell
                          key={day}
                          className={`p-1 text-center text-[10px] ${
                            weekend ? 'bg-slate-50' : ''
                          }`}
                        >
                          {hasAny ? (
                            <div className="flex flex-col gap-0.5 leading-tight">
                              {attendCount > 0 && (
                                <span className="text-emerald-600">✓{attendCount}</span>
                              )}
                              {lateCount > 0 && (
                                <span className="text-red-600">迟{lateCount}</span>
                              )}
                              {leaveCount > 0 && (
                                <span className="text-amber-600">假{leaveCount}</span>
                              )}
                              {tripCount > 0 && (
                                <span className="text-blue-600">差{tripCount}</span>
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center">
                      <span className="text-sm text-emerald-600">{totalAttend}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-amber-600">{totalLeave}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-red-600">{totalLate}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground shadow-lg">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          保存中...
        </div>
      )}
    </div>
  )
}