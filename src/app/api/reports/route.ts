import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireDataScopeResource, requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

// ─── GET: 分析报告列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const access = await requireDataScopeResource('reports')
  if (access instanceof Response) return access

  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || ''
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''

  const publishedOnly =
    access.session.user.role === 'inspector' ||
    access.session.user.role === 'engineer'
  const filters: Prisma.analysis_reportWhereInput[] = [
    publishedOnly ? { status: '已发布' } : {},
  ]
  if (keyword) {
    filters.push({
      OR: [
        { title: { contains: keyword, mode: 'insensitive' } },
        { report_no: { contains: keyword, mode: 'insensitive' } },
      ],
    })
  }
  if (type) filters.push({ type })
  if (status) filters.push({ status })

  const reports = await db.analysis_report.findMany({
    where: { AND: filters },
    include: {
      part_revision_links: {
        include: { part_revision: { include: { part: { select: { code: true, name: true } } } } },
      },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ reports })
}

// ─── POST: 创建报告（自动关联当前用户） ───

export async function POST(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { title, type, period, summary, conclusion, author, part_revision_ids = [] } = body

  if (!title || !type) {
    return NextResponse.json({ error: '标题和类型不能为空' }, { status: 400 })
  }

  if (!Array.isArray(part_revision_ids)) return NextResponse.json({ error: '零件版本引用格式错误' }, { status: 400 })
  const revisions = await db.part_revision.findMany({ where: { id: { in: part_revision_ids } }, select: { id: true, lifecycle_state: true } })
  if (revisions.length !== new Set(part_revision_ids).size || revisions.some((revision) => revision.lifecycle_state !== 'released')) {
    return NextResponse.json({ error: '报告只能引用存在且已发布的零件版本' }, { status: 400 })
  }
  const report = await db.analysis_report.create({
    data: {
      report_no: `BG-${Date.now()}`, title, type, period: period || null, summary: summary || null, conclusion: conclusion || null, author: author || '', user_id: access.user.id,
      part_revision_links: { create: part_revision_ids.map((part_revision_id: string) => ({ part_revision_id })) },
    },
    include: { part_revision_links: { include: { part_revision: { include: { part: { select: { code: true, name: true } } } } } } },
  })

  await logAudit({ userId: access.user.id, action: 'CREATE', entityType: 'analysis_report', entityId: report.id, after: { report_no: report.report_no, title: report.title }, request })
  return NextResponse.json({ report }, { status: 201 })
}

// ─── PUT: 更新报告内容 / 状态流转 ───

const VALID_TRANSITIONS: Record<string, string[]> = {
  '草稿': ['已发布'],
  '已发布': ['已归档'],
  '已归档': [],
}

export async function PUT(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access

  const body = await request.json()
  const { id, title, type, period, summary, conclusion, author, status, part_revision_ids } = body

  if (!id) {
    return NextResponse.json({ error: '缺少报告 ID' }, { status: 400 })
  }

  const existing = await db.analysis_report.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 })
  }
  const ownership = await requireOwnershipOrAdmin(existing.user_id)
  if (ownership instanceof Response) return ownership

  // 状态流转校验
  if (status && status !== existing.status) {
    const allowed = VALID_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `不允许从"${existing.status}"转为"${status}"，合法目标：${allowed.join('、') || '无'}` },
        { status: 400 },
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (type !== undefined) data.type = type
  if (period !== undefined) data.period = period || null
  if (summary !== undefined) data.summary = summary || null
  if (conclusion !== undefined) data.conclusion = conclusion || null
  if (author !== undefined) data.author = author
  if (status !== undefined) data.status = status

  if (part_revision_ids !== undefined) {
    if (!Array.isArray(part_revision_ids)) return NextResponse.json({ error: '零件版本引用格式错误' }, { status: 400 })
    const revisions = await db.part_revision.findMany({ where: { id: { in: part_revision_ids } }, select: { id: true, lifecycle_state: true } })
    if (revisions.length !== new Set(part_revision_ids).size || revisions.some((revision) => revision.lifecycle_state !== 'released')) {
      return NextResponse.json({ error: '报告只能引用存在且已发布的零件版本' }, { status: 400 })
    }
    data.part_revision_links = { deleteMany: {}, create: part_revision_ids.map((part_revision_id: string) => ({ part_revision_id })) }
  }
  const updated = await db.analysis_report.update({
    where: { id }, data,
    include: { part_revision_links: { include: { part_revision: { include: { part: { select: { code: true, name: true } } } } } } },
  })

  await logAudit({ userId: access.user.id, action: 'UPDATE', entityType: 'analysis_report', entityId: id, before: { status: existing.status, title: existing.title }, after: { status: updated.status, title: updated.title }, request })
  return NextResponse.json({ report: updated })
}

// ─── DELETE: 删除报告（仅草稿可删） ───

export async function DELETE(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少报告 ID' }, { status: 400 })
  }

  const existing = await db.analysis_report.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 })
  }
  const ownership = await requireOwnershipOrAdmin(existing.user_id)
  if (ownership instanceof Response) return ownership
  if (existing.status !== '草稿') {
    return NextResponse.json(
      { error: `仅草稿状态可删除，当前状态为"${existing.status}"` },
      { status: 409 },
    )
  }

  await db.analysis_report.delete({ where: { id } })
  await logAudit({ userId: access.user.id, action: 'DELETE', entityType: 'analysis_report', entityId: id, before: { title: existing.title }, request })
  return NextResponse.json({ success: true })
}
