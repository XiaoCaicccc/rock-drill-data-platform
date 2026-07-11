import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

// PUT — 仅更新不会随版本变更的主数据字段。
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const { id } = await params
    const body = await request.json()
    const current = await db.part.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: '零件不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(current.created_by)
    if (ownership instanceof Response) return ownership

    const data: Prisma.partUpdateInput = {}
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return NextResponse.json({ error: '零件名称不能为空' }, { status: 400 })
      data.name = body.name.trim()
    }
    if (body.category_id !== undefined) {
      const category = await db.part_category.findUnique({ where: { id: body.category_id } })
      if (!category) return NextResponse.json({ error: '所选类别不存在' }, { status: 400 })
      data.category = { connect: { id: body.category_id } }
    }
    if (body.equipment_id !== undefined) {
      if (body.equipment_id && !await db.equipment.findUnique({ where: { id: body.equipment_id } })) {
        return NextResponse.json({ error: '所选设备不存在' }, { status: 400 })
      }
      data.equipment = body.equipment_id ? { connect: { id: body.equipment_id } } : { disconnect: true }
    }
    if (body.install_date !== undefined) data.install_date = body.install_date ? new Date(body.install_date) : null
    if (body.working_hours !== undefined) data.working_hours = Number(body.working_hours) || 0
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)

    const part = await db.part.update({ where: { id }, data })
    await logAudit({
      userId: access.user.id,
      action: 'UPDATE',
      entityType: 'part',
      entityId: id,
      before: { name: current.name, is_active: current.is_active },
      after: { name: part.name, is_active: part.is_active },
      request,
    })
    return NextResponse.json({ part })
  } catch (error) {
    console.error('[PUT /api/parts/[id]]', error)
    return NextResponse.json({ error: '更新零件主数据失败' }, { status: 500 })
  }
}
