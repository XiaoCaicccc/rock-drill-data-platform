import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ============================================================
// GET — list parts with filters
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const keyword = searchParams.get('keyword')?.trim() ?? ''
    const status = searchParams.get('status')?.trim() ?? ''
    const category_id = searchParams.get('category_id')?.trim() ?? ''

    const where: Prisma.partWhereInput = {}

    if (keyword) {
      where.OR = [
        { code: { contains: keyword } },
        { name: { contains: keyword } },
        { specification: { contains: keyword } },
        { material: { contains: keyword } },
        { supplier: { contains: keyword } },
        { remark: { contains: keyword } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (category_id) {
      where.category_id = category_id
    }

    const list = await db.part.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, code: true } },
        equipment: { select: { id: true, machine_no: true, model: true } },
        _count: {
          select: { data_items: true },
        },
      },
      orderBy: { code: 'asc' },
    })

    const parts = list.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      category_id: p.category_id,
      category_name: p.category.name,
      category_code: p.category.code,
      specification: p.specification,
      material: p.material,
      supplier: p.supplier,
      equipment_id: p.equipment_id,
      equipment_machine_no: p.equipment?.machine_no ?? null,
      equipment_model: p.equipment?.model ?? null,
      install_date: p.install_date ? p.install_date.toISOString().slice(0, 10) : null,
      working_hours: p.working_hours,
      status: p.status,
      remark: p.remark,
      data_item_count: p._count.data_items,
    }))

    return NextResponse.json({ parts })
  } catch (error) {
    console.error('[GET /api/parts]', error)
    return NextResponse.json({ error: '获取零件列表失败' }, { status: 500 })
  }
}

// ============================================================
// POST — create part
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, name, category_id, specification, material, supplier, equipment_id, install_date, status, remark } = body

    if (!code?.trim()) {
      return NextResponse.json({ error: '零件编号不能为空' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: '零件名称不能为空' }, { status: 400 })
    }
    if (!category_id) {
      return NextResponse.json({ error: '请选择零件类别' }, { status: 400 })
    }

    // Uniqueness check
    const existing = await db.part.findUnique({ where: { code: code.trim() } })
    if (existing) {
      return NextResponse.json({ error: `零件编号 "${code}" 已存在` }, { status: 409 })
    }

    // Validate category exists
    const catExists = await db.part_category.findUnique({ where: { id: category_id } })
    if (!catExists) {
      return NextResponse.json({ error: '所选类别不存在' }, { status: 400 })
    }

    // Validate equipment if provided
    if (equipment_id) {
      const eqExists = await db.equipment.findUnique({ where: { id: equipment_id } })
      if (!eqExists) {
        return NextResponse.json({ error: '所选设备不存在' }, { status: 400 })
      }
    }

    const created = await db.part.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        category_id,
        specification: specification?.trim() ?? null,
        material: material?.trim() ?? null,
        supplier: supplier?.trim() ?? null,
        equipment_id: equipment_id || null,
        install_date: install_date ? new Date(install_date) : null,
        status: status ?? '在用',
        remark: remark?.trim() ?? null,
      },
    })

    return NextResponse.json({ part: created }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/parts]', error)
    return NextResponse.json({ error: '创建零件失败' }, { status: 500 })
  }
}

// ============================================================
// PUT — update part
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: '缺少零件 ID' }, { status: 400 })
    }

    const data: Prisma.partUpdateInput = {}

    if (fields.code !== undefined) {
      if (!fields.code?.trim()) {
        return NextResponse.json({ error: '零件编号不能为空' }, { status: 400 })
      }
      const existing = await db.part.findFirst({
        where: { code: fields.code.trim(), id: { not: id } },
      })
      if (existing) {
        return NextResponse.json(
          { error: `零件编号 "${fields.code}" 已被其他零件使用` },
          { status: 409 },
        )
      }
      data.code = fields.code.trim()
    }

    if (fields.name !== undefined) {
      if (!fields.name?.trim()) {
        return NextResponse.json({ error: '零件名称不能为空' }, { status: 400 })
      }
      data.name = fields.name.trim()
    }

    if (fields.category_id !== undefined) {
      if (fields.category_id) {
        const catExists = await db.part_category.findUnique({ where: { id: fields.category_id } })
        if (!catExists) {
          return NextResponse.json({ error: '所选类别不存在' }, { status: 400 })
        }
      }
      data.category = fields.category_id ? { connect: { id: fields.category_id } } : undefined
    }

    if (fields.specification !== undefined) {
      data.specification = fields.specification?.trim() ?? null
    }
    if (fields.material !== undefined) {
      data.material = fields.material?.trim() ?? null
    }
    if (fields.supplier !== undefined) {
      data.supplier = fields.supplier?.trim() ?? null
    }
    if (fields.equipment_id !== undefined) {
      if (fields.equipment_id) {
        const eqExists = await db.equipment.findUnique({ where: { id: fields.equipment_id } })
        if (!eqExists) {
          return NextResponse.json({ error: '所选设备不存在' }, { status: 400 })
        }
      }
      data.equipment = fields.equipment_id ? { connect: { id: fields.equipment_id } } : { disconnect: true }
    }
    if (fields.install_date !== undefined) {
      data.install_date = fields.install_date ? new Date(fields.install_date) : null
    }
    if (fields.status !== undefined) {
      data.status = fields.status
    }
    if (fields.working_hours !== undefined) {
      data.working_hours = Number(fields.working_hours) || 0
    }
    if (fields.remark !== undefined) {
      data.remark = fields.remark?.trim() ?? null
    }

    const updated = await db.part.update({ where: { id }, data })

    return NextResponse.json({ part: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '零件不存在' }, { status: 404 })
    }
    console.error('[PUT /api/parts]', error)
    return NextResponse.json({ error: '更新零件失败' }, { status: 500 })
  }
}

// ============================================================
// DELETE — remove part
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少零件 ID' }, { status: 400 })
    }

    // Check for related inspection data items
    const dataItemCount = await db.inspection_data_item.count({ where: { part_id: id } })
    if (dataItemCount > 0) {
      return NextResponse.json(
        { error: `该零件下尚有 ${dataItemCount} 条检测数据，请先删除相关检测记录` },
        { status: 409 },
      )
    }

    await db.part.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '零件不存在' }, { status: 404 })
    }
    console.error('[DELETE /api/parts]', error)
    return NextResponse.json({ error: '删除零件失败' }, { status: 500 })
  }
}