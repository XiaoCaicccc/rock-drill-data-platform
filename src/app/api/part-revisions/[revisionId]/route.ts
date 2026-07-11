import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ revisionId: string }> }
const CRITICALITIES = ['normal', 'important', 'critical'] as const

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// PUT — 仅 draft 版本可编辑；提交评审后不可继续编辑。
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const { revisionId } = await params
    const body = await request.json()
    const revision = await db.part_revision.findUnique({
      where: { id: revisionId },
      include: { part: { select: { created_by: true } } },
    })
    if (!revision) return NextResponse.json({ error: '零件版本不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(revision.part.created_by)
    if (ownership instanceof Response) return ownership
    if (revision.lifecycle_state !== 'draft') {
      return NextResponse.json({ error: '仅草稿版本允许编辑' }, { status: 409 })
    }

    const data: Prisma.part_revisionUpdateInput = {}
    for (const field of ['drawing_no', 'unit', 'specification', 'material', 'supplier', 'change_summary', 'remark'] as const) {
      if (body[field] !== undefined) data[field] = optionalText(body[field])
    }
    if (body.criticality !== undefined) {
      if (!CRITICALITIES.includes(body.criticality)) return NextResponse.json({ error: '关键性字段不合法' }, { status: 400 })
      data.criticality = body.criticality
    }
    if (body.key_characteristics !== undefined) {
      if (body.key_characteristics !== null && typeof body.key_characteristics !== 'object') {
        return NextResponse.json({ error: '关键特性必须为 JSON 对象或数组' }, { status: 400 })
      }
      data.key_characteristics = body.key_characteristics === null
        ? Prisma.JsonNull
        : body.key_characteristics as Prisma.InputJsonValue
    }
    if (body.effective_from !== undefined) data.effective_from = body.effective_from ? new Date(body.effective_from) : null
    if (body.effective_to !== undefined) data.effective_to = body.effective_to ? new Date(body.effective_to) : null
    if (body.lifecycle_state !== undefined) {
      if (body.lifecycle_state !== 'reviewing') return NextResponse.json({ error: '草稿只能提交为评审中状态' }, { status: 400 })
      data.lifecycle_state = 'reviewing'
    }

    const updated = await db.part_revision.update({ where: { id: revisionId }, data })
    await logAudit({
      userId: access.user.id,
      action: 'UPDATE',
      entityType: 'part_revision',
      entityId: revisionId,
      before: { lifecycle_state: revision.lifecycle_state, revision_no: revision.revision_no },
      after: { lifecycle_state: updated.lifecycle_state, revision_no: updated.revision_no },
      request,
    })
    return NextResponse.json({ revision: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '图号已被其他版本使用' }, { status: 409 })
    }
    console.error('[PUT /api/part-revisions/[revisionId]]', error)
    return NextResponse.json({ error: '更新零件版本失败' }, { status: 500 })
  }
}
