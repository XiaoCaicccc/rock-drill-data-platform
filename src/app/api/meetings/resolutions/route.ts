import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

// ─── GET: 决议列表 ───

export async function GET(request: NextRequest) {
  const access = await requireAuth()
  if (access instanceof Response) return access
  const meetingId = request.nextUrl.searchParams.get('meeting_id')
  if (!meetingId) {
    return NextResponse.json({ error: '缺少 meeting_id' }, { status: 400 })
  }

  const resolutions = await db.meeting_resolution.findMany({
    where: { meeting_id: meetingId },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json({ resolutions })
}

// ─── POST: 创建决议（可同时生成关联任务） ───

export async function POST(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { meeting_id, content, responsible_person, due_date, create_task } = body

  if (!meeting_id || !content?.trim()) {
    return NextResponse.json({ error: '会议 ID 和决议内容不能为空' }, { status: 400 })
  }

  const meeting = await db.meeting.findUnique({ where: { id: meeting_id } })
  if (!meeting) {
    return NextResponse.json({ error: '会议不存在' }, { status: 404 })
  }
  const ownership = await requireOwnershipOrAdmin(meeting.created_by)
  if (ownership instanceof Response) return ownership

  const resolution = await db.meeting_resolution.create({
    data: {
      meeting_id,
      content: content.trim(),
      responsible_person: responsible_person || null,
      due_date: due_date ? new Date(due_date) : null,
    },
  })

  let task: Awaited<ReturnType<typeof db.task.create>> | null = null
  if (create_task) {
    task = await db.task.create({
      data: {
        title: `[决议] ${content.trim().slice(0, 50)}`,
        description: `来源会议：${meeting.title}`,
        priority: '高',
        status: '待办',
        assignee: responsible_person || null,
        due_date: due_date ? new Date(due_date) : null,
        task_type: '决议',
        user_id: access.user.id,
      },
    })
  }

  await logAudit({ userId: access.user.id, action: 'CREATE', entityType: 'meeting_resolution', entityId: resolution.id, after: { meeting_id, content: resolution.content }, request })
  return NextResponse.json({ resolution, task }, { status: 201 })
}

// ─── PUT: 更新决议状态 ───

export async function PUT(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { id, content, responsible_person, due_date, status } = body

  if (!id) {
    return NextResponse.json({ error: '缺少决议 ID' }, { status: 400 })
  }

  const existing = await db.meeting_resolution.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '决议不存在' }, { status: 404 })
  }
  const meeting = await db.meeting.findUnique({ where: { id: existing.meeting_id } })
  const ownership = await requireOwnershipOrAdmin(meeting?.created_by)
  if (ownership instanceof Response) return ownership

  const data: Record<string, unknown> = {}
  if (content !== undefined) data.content = content.trim()
  if (responsible_person !== undefined) data.responsible_person = responsible_person || null
  if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null
  if (status !== undefined) data.status = status

  const updated = await db.meeting_resolution.update({ where: { id }, data })

  await logAudit({ userId: access.user.id, action: 'UPDATE', entityType: 'meeting_resolution', entityId: id, before: { status: existing.status }, after: { status: updated.status }, request })
  return NextResponse.json({ resolution: updated })
}
