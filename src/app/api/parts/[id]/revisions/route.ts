import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

// POST — 从当前有效版本复制一个下一版草稿。图号必须在草稿中重新填写，确保全局唯一。
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const { id } = await params
    const part = await db.part.findUnique({
      where: { id },
      include: { current_revision: true },
    })
    if (!part) return NextResponse.json({ error: '零件不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(part.created_by)
    if (ownership instanceof Response) return ownership
    if (!part.current_revision) return NextResponse.json({ error: '当前没有已发布版本，不能升版' }, { status: 409 })

    const workInProgress = await db.part_revision.findFirst({
      where: { part_id: id, lifecycle_state: { in: ['draft', 'reviewing'] } },
      select: { revision_no: true },
    })
    if (workInProgress) {
      return NextResponse.json({ error: `版本 ${workInProgress.revision_no} 正在处理，不能重复升版` }, { status: 409 })
    }

    const latest = await db.part_revision.findFirst({
      where: { part_id: id },
      orderBy: { revision_seq: 'desc' },
      select: { revision_seq: true },
    })
    const nextSeq = (latest?.revision_seq ?? 0) + 1
    if (nextSeq > 99) return NextResponse.json({ error: '版本号已达到 99，无法继续升版' }, { status: 409 })

    const revision = await db.part_revision.create({
      data: {
        part_id: id,
        revision_no: String(nextSeq).padStart(2, '0'),
        revision_seq: nextSeq,
        lifecycle_state: 'draft',
        drawing_no: null,
        unit: part.current_revision.unit,
        specification: part.current_revision.specification,
        material: part.current_revision.material,
        supplier: part.current_revision.supplier,
        criticality: part.current_revision.criticality,
        key_characteristics: part.current_revision.key_characteristics ?? undefined,
        change_summary: '从当前已发布版本升版创建',
        effective_from: part.current_revision.effective_from,
        effective_to: null,
        remark: part.current_revision.remark,
        created_by: access.user.id,
      },
    })

    await logAudit({
      userId: access.user.id,
      action: 'CREATE',
      entityType: 'part_revision',
      entityId: revision.id,
      after: { part_id: id, revision_no: revision.revision_no },
      request,
    })
    return NextResponse.json({ revision }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/parts/[id]/revisions]', error)
    return NextResponse.json({ error: '创建升版草稿失败' }, { status: 500 })
  }
}
