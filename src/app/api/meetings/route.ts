import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyDataScope, requireAuth, requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

// ─── GET: 会议列表 ───

export async function GET() {
  const access = await requireAuth()
  if (access instanceof Response) return access
  const meetings = await db.meeting.findMany({
    where: applyDataScope(access, {}),
    orderBy: { meeting_date: 'desc' },
    include: { resolutions: true },
  })

  return NextResponse.json({ meetings })
}

// ─── POST: 创建会议 ───

export async function POST(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { title, meeting_date, location, organizer, participants } = body

  if (!title?.trim() || !meeting_date || !organizer?.trim()) {
    return NextResponse.json({ error: '标题、日期和组织人不能为空' }, { status: 400 })
  }

  const meeting = await db.meeting.create({
    data: {
      title: title.trim(),
      meeting_date: new Date(meeting_date),
      location: location || null,
      organizer: organizer.trim(),
      participants: participants || null,
      created_by: access.user.id,
    },
  })

  await logAudit({ userId: access.user.id, action: 'CREATE', entityType: 'meeting', entityId: meeting.id, after: { title: meeting.title }, request })
  return NextResponse.json({ meeting }, { status: 201 })
}

// ─── PUT: 更新会议（纪要/状态） ───

export async function PUT(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { id, title, meeting_date, location, organizer, participants, minutes_content, status } = body

  if (!id) {
    return NextResponse.json({ error: '缺少会议 ID' }, { status: 400 })
  }

  const existing = await db.meeting.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '会议不存在' }, { status: 404 })
  }
  const ownership = await requireOwnershipOrAdmin(existing.created_by)
  if (ownership instanceof Response) return ownership

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title.trim()
  if (meeting_date !== undefined) data.meeting_date = new Date(meeting_date)
  if (location !== undefined) data.location = location || null
  if (organizer !== undefined) data.organizer = organizer.trim()
  if (participants !== undefined) data.participants = participants || null
  if (minutes_content !== undefined) data.minutes_content = minutes_content || null
  if (status !== undefined) data.status = status

  const updated = await db.meeting.update({
    where: { id },
    data,
    include: { resolutions: true },
  })

  await logAudit({ userId: access.user.id, action: 'UPDATE', entityType: 'meeting', entityId: id, before: { status: existing.status, title: existing.title }, after: { status: updated.status, title: updated.title }, request })
  return NextResponse.json({ meeting: updated })
}
