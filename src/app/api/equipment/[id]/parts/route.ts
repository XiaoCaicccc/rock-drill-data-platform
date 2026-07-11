import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireOwnershipOrAdmin } from '@/lib/permissions'

// GET — 当前装配中的受控零件版本，供检测录入和设备详情使用。
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireAuth()
    if (access instanceof Response) return access
    const { id } = await params
    const equipment = await db.equipment.findUnique({ where: { id } })
    if (!equipment) return NextResponse.json({ error: '设备不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(equipment.created_by)
    if (ownership instanceof Response) return ownership

    const installations = await db.equipment_part_installation.findMany({
      where: { equipment_id: id, status: 'active' },
      include: { part_revision: { include: { part: { include: { category: { select: { name: true, code: true } } } } } } },
      orderBy: { installed_at: 'desc' },
    })

    return NextResponse.json({
      parts: installations.map((installation) => ({
        id: installation.part_revision.id,
        part_revision_id: installation.part_revision.id,
        part_id: installation.part_revision.part_id,
        code: installation.part_revision.part.code,
        name: installation.part_revision.part.name,
        category_name: installation.part_revision.part.category.name,
        category_code: installation.part_revision.part.category.code,
        revision_no: installation.part_revision.revision_no,
        drawing_no: installation.part_revision.drawing_no,
        specification: installation.part_revision.specification,
        material: installation.part_revision.material,
        supplier: installation.part_revision.supplier,
        installed_at: installation.installed_at.toISOString().slice(0, 10),
        status: installation.status,
        remark: installation.remark,
      })),
    })
  } catch (error) {
    console.error('[GET /api/equipment/[id]/parts]', error)
    return NextResponse.json({ error: '获取设备零件列表失败' }, { status: 500 })
  }
}
