import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ revisionId: string }> }

// POST — 仅管理员可发布评审中的版本，并在同一事务中切换当前有效版本。
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await requireRole(['admin'])
    if (access instanceof Response) return access
    const { revisionId } = await params
    const revision = await db.part_revision.findUnique({ where: { id: revisionId } })
    if (!revision) return NextResponse.json({ error: '零件版本不存在' }, { status: 404 })
    if (revision.lifecycle_state !== 'reviewing') {
      return NextResponse.json({ error: '仅评审中的版本可以发布' }, { status: 409 })
    }
    if (!revision.drawing_no) return NextResponse.json({ error: '发布前必须填写图号' }, { status: 400 })

    const released = await db.$transaction(async (tx) => {
      const updatedRevision = await tx.part_revision.update({
        where: { id: revisionId },
        data: {
          lifecycle_state: 'released',
          released_at: new Date(),
          released_by: access.user.id,
          effective_from: revision.effective_from ?? new Date(),
        },
      })
      const part = await tx.part.update({
        where: { id: revision.part_id },
        data: { current_revision_id: revisionId },
      })
      return { part, revision: updatedRevision }
    })

    await logAudit({
      userId: access.user.id,
      action: 'UPDATE',
      entityType: 'part_revision',
      entityId: revisionId,
      before: { lifecycle_state: revision.lifecycle_state },
      after: { lifecycle_state: 'released', part_id: revision.part_id, revision_no: revision.revision_no },
      request,
    })
    return NextResponse.json(released)
  } catch (error) {
    console.error('[POST /api/part-revisions/[revisionId]/release]', error)
    return NextResponse.json({ error: '发布零件版本失败' }, { status: 500 })
  }
}
