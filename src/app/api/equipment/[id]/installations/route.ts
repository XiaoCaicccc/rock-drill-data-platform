import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

async function getEquipmentAccess(equipmentId: string, write = false) {
  const access = write
    ? await requireRole(['admin', 'quality_manager', 'engineer'])
    : await requireRole(['admin', 'quality_manager', 'engineer', 'inspector', 'viewer'])
  if (access instanceof Response) return access
  const equipment = await db.equipment.findUnique({ where: { id: equipmentId } })
  if (!equipment) return new Response(JSON.stringify({ error: '设备不存在' }), { status: 404 })
  const ownership = await requireOwnershipOrAdmin(equipment.created_by)
  if (ownership instanceof Response) return ownership
  return { access, equipment }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const result = await getEquipmentAccess(id)
  if (result instanceof Response) return result
  const installations = await db.equipment_part_installation.findMany({
    where: { equipment_id: id },
    include: { part_revision: { include: { part: { select: { id: true, code: true, name: true } } } } },
    orderBy: { installed_at: 'desc' },
  })
  return NextResponse.json({ installations })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const result = await getEquipmentAccess(id, true)
    if (result instanceof Response) return result
    const body = await request.json()
    if (!body.part_revision_id) return NextResponse.json({ error: '缺少零件版本 ID' }, { status: 400 })
    const revision = await db.part_revision.findUnique({ where: { id: body.part_revision_id } })
    if (!revision) return NextResponse.json({ error: '零件版本不存在' }, { status: 404 })
    if (revision.lifecycle_state !== 'released') return NextResponse.json({ error: '仅已发布版本允许装配' }, { status: 409 })

    const installation = await db.$transaction(async (tx) => {
      await tx.equipment_part_installation.updateMany({
        where: { equipment_id: id, status: 'active', part_revision: { part_id: revision.part_id } },
        data: { status: 'removed', removed_at: new Date(body.installed_at ?? Date.now()) },
      })
      return tx.equipment_part_installation.create({
        data: {
          equipment_id: id,
          part_revision_id: revision.id,
          installed_at: body.installed_at ? new Date(body.installed_at) : new Date(),
          status: 'active',
          created_by: result.access.user.id,
          remark: typeof body.remark === 'string' ? body.remark.trim() || null : null,
        },
      })
    })
    await logAudit({ userId: result.access.user.id, action: 'CREATE', entityType: 'equipment_part_installation', entityId: installation.id, after: { equipment_id: id, part_revision_id: revision.id }, request })
    return NextResponse.json({ installation }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/equipment/[id]/installations]', error)
    return NextResponse.json({ error: '新增装配记录失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const result = await getEquipmentAccess(id, true)
    if (result instanceof Response) return result
    const body = await request.json()
    if (!body.installation_id) return NextResponse.json({ error: '缺少装配记录 ID' }, { status: 400 })
    const current = await db.equipment_part_installation.findFirst({ where: { id: body.installation_id, equipment_id: id } })
    if (!current) return NextResponse.json({ error: '装配记录不存在' }, { status: 404 })
    const installation = await db.equipment_part_installation.update({
      where: { id: current.id },
      data: { status: 'removed', removed_at: body.removed_at ? new Date(body.removed_at) : new Date() },
    })
    await logAudit({ userId: result.access.user.id, action: 'UPDATE', entityType: 'equipment_part_installation', entityId: installation.id, before: { status: current.status }, after: { status: installation.status }, request })
    return NextResponse.json({ installation })
  } catch (error) {
    console.error('[PUT /api/equipment/[id]/installations]', error)
    return NextResponse.json({ error: '更新装配记录失败' }, { status: 500 })
  }
}
