import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface CategoryTemplateItem {
  id: string
  param_name: string
  param_code: string
  unit: string | null
  data_type: string
  standard_min: number | null
  standard_max: number | null
  optimal_min: number | null
  optimal_max: number | null
  sort_order: number
}

export interface CategoryTemplate {
  id: string
  name: string
  version: number
  items: CategoryTemplateItem[]
}

export interface CategoryWithStats {
  id: string
  name: string
  code: string
  description: string | null
  standard_param_count: number
  part_count: number
  template: CategoryTemplate | null
}

export async function GET() {
  try {
    const categories = await db.part_category.findMany({
      include: {
        _count: {
          select: { parts: true },
        },
        parameter_template: {
          include: {
            items: {
              orderBy: { sort_order: 'asc' },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    const result: CategoryWithStats[] = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      code: cat.code,
      description: cat.description,
      standard_param_count: cat.standard_param_count,
      part_count: cat._count.parts,
      template: cat.parameter_template
        ? {
            id: cat.parameter_template.id,
            name: cat.parameter_template.name,
            version: cat.parameter_template.version,
            items: cat.parameter_template.items.map((item) => ({
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
            })),
          }
        : null,
    }))

    return NextResponse.json({ categories: result })
  } catch (error) {
    console.error('[GET /api/categories]', error)
    return NextResponse.json(
      { error: '获取零件类别失败' },
      { status: 500 },
    )
  }
}