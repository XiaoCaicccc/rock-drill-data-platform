import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const createInspectionSchema = z.object({
  partId: z.string().min(1),
  batchNo: z.string().optional(),
  inspector: z.string().min(1),
  inspectionDate: z.string(),
  hardness: z.number().optional(),
  dimensionA: z.number().optional(),
  dimensionB: z.number().optional(),
  weight: z.number().optional(),
  surfaceQuality: z.string().optional(),
  innerDefect: z.string().optional(),
  result: z.string().default('待检'),
  remark: z.string().optional(),
})

// GET /api/inspections - 获取检测记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''
    const result = searchParams.get('result') || ''
    const categoryId = searchParams.get('categoryId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { recordNo: { contains: search } },
        { part: { name: { contains: search } } },
        { part: { code: { contains: search } } },
        { inspector: { contains: search } },
        { batchNo: { contains: search } },
      ]
    }

    if (result) {
      where.result = result
    }

    if (categoryId) {
      where.part = { ...((where.part as Record<string, unknown>) || {}), categoryId }
    }

    if (startDate || endDate) {
      where.inspectionDate = {}
      if (startDate) (where.inspectionDate as Record<string, unknown>).gte = new Date(startDate)
      if (endDate) (where.inspectionDate as Record<string, unknown>).lte = new Date(endDate)
    }

    const [total, records] = await Promise.all([
      db.inspectionRecord.count({ where }),
      db.inspectionRecord.findMany({
        where,
        include: {
          part: {
            include: { category: true }
          }
        },
        orderBy: { inspectionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
    ])

    return NextResponse.json({
      data: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取检测记录失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/inspections - 创建检测记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createInspectionSchema.parse(body)

    // 获取当前最大编号
    const lastRecord = await db.inspectionRecord.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { recordNo: true }
    })

    let nextNum = 1
    if (lastRecord?.recordNo) {
      const match = lastRecord.recordNo.match(/JY-2025-(\d{4})/)
      if (match) nextNum = parseInt(match[1]) + 1
    }

    const record = await db.inspectionRecord.create({
      data: {
        ...validated,
        inspectionDate: new Date(validated.inspectionDate),
        recordNo: `JY-2025-${String(nextNum).padStart(4, '0')}`,
      },
      include: {
        part: { include: { category: true } }
      }
    })

    return NextResponse.json({ data: record }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '数据验证失败', details: error.errors }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : '创建检测记录失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/inspections - 更新检测记录
export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json()
    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })
    }

    const validated = createInspectionSchema.parse(body)

    const record = await db.inspectionRecord.update({
      where: { id },
      data: {
        ...validated,
        inspectionDate: new Date(validated.inspectionDate),
      },
      include: {
        part: { include: { category: true } }
      }
    })

    return NextResponse.json({ data: record })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '数据验证失败', details: error.errors }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : '更新检测记录失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/inspections?id=xxx - 删除检测记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })
    }

    await db.inspectionRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除检测记录失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}