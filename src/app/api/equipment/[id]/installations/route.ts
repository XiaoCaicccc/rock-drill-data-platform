import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import {
  createInstallation,
  InstallationMutationError,
  removeInstallation,
} from '@/lib/installation-mutation-service'
import { parseStrictRfc3339Timestamp } from '@/lib/inspection-integrity'

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
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const body = await request.json()
    if (!body.part_revision_id) return NextResponse.json({ error: '缺少零件版本 ID' }, { status: 400 })
    const authoritativeNow = new Date()
    let installedAt = authoritativeNow
    if (body.installed_at !== undefined) {
      try {
        installedAt = parseStrictRfc3339Timestamp(body.installed_at).date
      } catch {
        return NextResponse.json({ error: 'installed_at 必须是带时区的 RFC3339 时间' }, { status: 400 })
      }
    }
    const installation = await createInstallation({
      equipmentId: id,
      partRevisionId: body.part_revision_id,
      installedAt,
      remark: typeof body.remark === 'string' ? body.remark.trim() || null : null,
      actor: { id: access.user.id, role: access.user.role },
      request,
    }, { db, audit: logAudit })
    return NextResponse.json({ installation }, { status: 201 })
  } catch (error) {
    if (error instanceof InstallationMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[POST /api/equipment/[id]/installations]', error)
    return NextResponse.json({ error: '新增装配记录失败' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const body = await request.json()
    if (!body.installation_id) return NextResponse.json({ error: '缺少装配记录 ID' }, { status: 400 })
    const authoritativeNow = new Date()
    let removedAt = authoritativeNow
    if (body.removed_at !== undefined) {
      try {
        removedAt = parseStrictRfc3339Timestamp(body.removed_at).date
      } catch {
        return NextResponse.json({ error: 'removed_at 必须是带时区的 RFC3339 时间' }, { status: 400 })
      }
    }
    const installation = await removeInstallation({
      equipmentId: id,
      installationId: body.installation_id,
      removedAt,
      actor: { id: access.user.id, role: access.user.role },
      request,
    }, { db, audit: logAudit })
    return NextResponse.json({ installation })
  } catch (error) {
    if (error instanceof InstallationMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[PUT /api/equipment/[id]/installations]', error)
    return NextResponse.json({ error: '更新装配记录失败' }, { status: 500 })
  }
}
