import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface EquipmentPart {
  id: string
  code: string
  name: string
  category_name: string
  category_code: string
  specification: string | null
  material: string | null
  supplier: string | null
  install_date: string | null
  working_hours: number
  status: string
  remark: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const parts = await db.part.findMany({
      where: { equipment_id: id },
      include: {
        category: {
          select: { name: true, code: true },
        },
      },
      orderBy: { code: 'asc' },
    })

    const result: EquipmentPart[] = parts.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category_name: p.category.name,
      category_code: p.category.code,
      specification: p.specification,
      material: p.material,
      supplier: p.supplier,
      install_date: p.install_date ? p.install_date.toISOString().slice(0, 10) : null,
      working_hours: p.working_hours,
      status: p.status,
      remark: p.remark,
    }))

    return NextResponse.json({ parts: result })
  } catch (error) {
    console.error('[GET /api/equipment/[id]/parts]', error)
    return NextResponse.json({ error: '获取设备零件列表失败' }, { status: 500 })
  }
}