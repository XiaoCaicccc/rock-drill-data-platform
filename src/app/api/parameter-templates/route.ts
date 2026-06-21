import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ============================================================
// GET — list all templates with items
// ============================================================

export async function GET() {
  try {
    const templates = await db.parameter_template.findMany({
      include: {
        category: { select: { id: true, name: true, code: true } },
        items: { orderBy: { sort_order: 'asc' } },
      },
      orderBy: { category: { code: 'asc' } },
    })

    const result = templates.map((t) => ({
      id: t.id,
      category_id: t.category_id,
      category_name: t.category.name,
      category_code: t.category.code,
      name: t.name,
      version: t.version,
      item_count: t.items.length,
      items: t.items.map((item) => ({
        id: item.id,
        param_name: item.param_name,
        param_code: item.param_code,
        unit: item.unit,
        data_type: item.data_type,
        standard_min: item.standard_min,
        standard_max: item.standard_max,
        optimal_min: item.optimal_min,
        optimal_max: item.optimal_max,
        sort_order: item.sort_order,
        options: item.options,
      })),
    }))

    return NextResponse.json({ templates: result })
  } catch (error) {
    console.error('[GET /api/parameter-templates]', error)
    return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 })
  }
}

// ============================================================
// POST — create template (used for copy as well)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category_id, name, items, version } = body

    if (!category_id) {
      return NextResponse.json({ error: '缺少类别 ID' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 })
    }

    // Check if template already exists for this category
    const existing = await db.parameter_template.findUnique({
      where: { category_id },
    })
    if (existing) {
      return NextResponse.json(
        { error: `类别已存在模板（${existing.name}），请编辑现有模板或先删除` },
        { status: 409 },
      )
    }

    const template = await db.parameter_template.create({
      data: {
        category_id,
        name: name.trim(),
        version: version ?? 1,
        items: {
          create: (items ?? []).map((item: Record<string, unknown>, idx: number) => ({
            param_name: (item.param_name as string) || `参数${idx + 1}`,
            param_code: (item.param_code as string) || `P${String(idx + 1).padStart(3, '0')}`,
            unit: (item.unit as string) || null,
            data_type: (item.data_type as string) || 'number',
            standard_min: item.standard_min != null ? Number(item.standard_min) : null,
            standard_max: item.standard_max != null ? Number(item.standard_max) : null,
            optimal_min: item.optimal_min != null ? Number(item.optimal_min) : null,
            optimal_max: item.optimal_max != null ? Number(item.optimal_max) : null,
            sort_order: idx,
            options: (item.options as string) || null,
          })),
        },
      },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/parameter-templates]', error)
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 })
  }
}

// ============================================================
// PUT — update template metadata or items
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, version, items } = body

    if (!id) {
      return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 })
    }

    const data: Prisma.parameter_templateUpdateInput = {}
    if (name !== undefined) {
      if (!name?.trim()) return NextResponse.json({ error: '模板名称不能为空' }, { status: 400 })
      data.name = name.trim()
    }
    if (version !== undefined) {
      data.version = Number(version) || 1
    }

    // If items array provided, full-sync: delete old + create new
    if (items !== undefined && Array.isArray(items)) {
      // Delete existing items
      await db.parameter_item.deleteMany({ where: { template_id: id } })
      // Create new items
      data.items = {
        create: items.map((item: Record<string, unknown>, idx: number) => ({
          param_name: (item.param_name as string) || `参数${idx + 1}`,
          param_code: (item.param_code as string) || `P${String(idx + 1).padStart(3, '0')}`,
          unit: (item.unit as string) || null,
          data_type: (item.data_type as string) || 'number',
          standard_min: item.standard_min != null ? Number(item.standard_min) : null,
          standard_max: item.standard_max != null ? Number(item.standard_max) : null,
          optimal_min: item.optimal_min != null ? Number(item.optimal_min) : null,
          optimal_max: item.optimal_max != null ? Number(item.optimal_max) : null,
          sort_order: idx,
          options: (item.options as string) || null,
        })),
      }
    }

    const updated = await db.parameter_template.update({
      where: { id },
      data,
      include: { items: { orderBy: { sort_order: 'asc' } } },
    })

    return NextResponse.json({ template: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }
    console.error('[PUT /api/parameter-templates]', error)
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

// ============================================================
// DELETE — remove template and its items (cascade)
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少模板 ID' }, { status: 400 })
    }

    // Check for related inspection data items
    const itemIds = await db.parameter_item.findMany({
      where: { template_id: id },
      select: { id: true },
    })
    if (itemIds.length > 0) {
      const ids = itemIds.map((i) => i.id)
      const dataCount = await db.inspection_data_item.count({
        where: { param_item_id: { in: ids } },
      })
      if (dataCount > 0) {
        return NextResponse.json(
          { error: `模板参数项下尚有 ${dataCount} 条检测数据，无法删除` },
          { status: 409 },
        )
      }
    }

    await db.parameter_template.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 })
    }
    console.error('[DELETE /api/parameter-templates]', error)
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 })
  }
}