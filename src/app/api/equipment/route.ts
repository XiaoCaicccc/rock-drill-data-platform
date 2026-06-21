import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ============================================================
// Types
// ============================================================

interface EquipmentRow {
  id: string
  machine_no: string
  model: string
  manufacturer: string | null
  production_date: string | null
  status: string
  current_location: string | null
  total_working_hours: number
  remark: string | null
  created_at: string
  updated_at: string
  part_count: number
  inspection_count: number
}

// ============================================================
// GET — list equipment with optional filters
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const keyword = searchParams.get('keyword')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? ''

    const where: Prisma.equipmentWhereInput = {}

    if (keyword) {
      where.OR = [
        { machine_no: { contains: keyword } },
        { model: { contains: keyword } },
        { manufacturer: { contains: keyword } },
        { current_location: { contains: keyword } },
        { remark: { contains: keyword } },
      ]
    }

    if (status) {
      where.status = status
    }

    const list = await db.equipment.findMany({
      where,
      include: {
        _count: {
          select: {
            parts: true,
            inspection_records: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    const equipment: EquipmentRow[] = list.map((e) => ({
      id: e.id,
      machine_no: e.machine_no,
      model: e.model,
      manufacturer: e.manufacturer,
      production_date: e.production_date ? e.production_date.toISOString().slice(0, 10) : null,
      status: e.status,
      current_location: e.current_location,
      total_working_hours: e.total_working_hours,
      remark: e.remark,
      created_at: e.created_at.toISOString(),
      updated_at: e.updated_at.toISOString(),
      part_count: e._count.parts,
      inspection_count: e._count.inspection_records,
    }))

    return NextResponse.json({ equipment })
  } catch (error) {
    console.error('[GET /api/equipment]', error)
    return NextResponse.json({ error: '获取设备列表失败' }, { status: 500 })
  }
}

// ============================================================
// POST — create equipment
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      machine_no,
      model,
      manufacturer,
      production_date,
      status,
      current_location,
      total_working_hours,
      remark,
    } = body

    if (!machine_no?.trim()) {
      return NextResponse.json({ error: '机头编号不能为空' }, { status: 400 })
    }
    if (!model?.trim()) {
      return NextResponse.json({ error: '型号不能为空' }, { status: 400 })
    }

    // Uniqueness check
    const existing = await db.equipment.findUnique({
      where: { machine_no: machine_no.trim() },
    })
    if (existing) {
      return NextResponse.json({ error: `机头编号 "${machine_no}" 已存在` }, { status: 409 })
    }

    const data: Prisma.equipmentCreateInput = {
      machine_no: machine_no.trim(),
      model: model.trim(),
      manufacturer: manufacturer?.trim() ?? null,
      production_date: production_date ? new Date(production_date) : null,
      status: status ?? '在用',
      current_location: current_location?.trim() ?? null,
      total_working_hours: total_working_hours ?? 0,
      remark: remark?.trim() ?? null,
    }

    const created = await db.equipment.create({ data })

    return NextResponse.json({ equipment: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/equipment]', error)
    return NextResponse.json({ error: '创建设备失败' }, { status: 500 })
  }
}

// ============================================================
// PUT — update equipment
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: '缺少设备 ID' }, { status: 400 })
    }

    const data: Prisma.equipmentUpdateInput = {}

    if (fields.machine_no !== undefined) {
      if (!fields.machine_no?.trim()) {
        return NextResponse.json({ error: '机头编号不能为空' }, { status: 400 })
      }
      // Uniqueness check (exclude self)
      const existing = await db.equipment.findFirst({
        where: {
          machine_no: fields.machine_no.trim(),
          id: { not: id },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: `机头编号 "${fields.machine_no}" 已被其他设备使用` },
          { status: 409 },
        )
      }
      data.machine_no = fields.machine_no.trim()
    }

    if (fields.model !== undefined) {
      if (!fields.model?.trim()) {
        return NextResponse.json({ error: '型号不能为空' }, { status: 400 })
      }
      data.model = fields.model.trim()
    }

    if (fields.manufacturer !== undefined) {
      data.manufacturer = fields.manufacturer?.trim() ?? null
    }
    if (fields.production_date !== undefined) {
      data.production_date = fields.production_date ? new Date(fields.production_date) : null
    }
    if (fields.status !== undefined) {
      data.status = fields.status
    }
    if (fields.current_location !== undefined) {
      data.current_location = fields.current_location?.trim() ?? null
    }
    if (fields.total_working_hours !== undefined) {
      data.total_working_hours = Number(fields.total_working_hours) || 0
    }
    if (fields.remark !== undefined) {
      data.remark = fields.remark?.trim() ?? null
    }

    const updated = await db.equipment.update({
      where: { id },
      data,
    })

    return NextResponse.json({ equipment: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '设备不存在' }, { status: 404 })
    }
    console.error('[PUT /api/equipment]', error)
    return NextResponse.json({ error: '更新设备失败' }, { status: 500 })
  }
}

// ============================================================
// DELETE — remove equipment
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少设备 ID' }, { status: 400 })
    }

    // Check for related parts
    const partCount = await db.part.count({ where: { equipment_id: id } })
    if (partCount > 0) {
      return NextResponse.json(
        { error: `该设备下尚有 ${partCount} 个关联零件，请先删除或解绑零件` },
        { status: 409 },
      )
    }

    await db.equipment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '设备不存在' }, { status: 404 })
    }
    console.error('[DELETE /api/equipment]', error)
    return NextResponse.json({ error: '删除设备失败' }, { status: 500 })
  }
}