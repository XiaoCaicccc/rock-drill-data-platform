import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET: 单条检测记录完整明细 ───

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const record = await db.inspection_record.findUnique({
    where: { id },
    include: {
      equipment: { select: { id: true, machine_no: true, model: true, status: true } },
      data_items: {
        orderBy: [
          { part: { code: 'asc' } },
          { param_item: { sort_order: 'asc' } },
        ],
        include: {
          part: { select: { id: true, code: true, name: true, category_id: true } },
          param_item: {
            select: {
              id: true,
              param_name: true,
              param_code: true,
              unit: true,
              data_type: true,
              standard_min: true,
              standard_max: true,
              optimal_min: true,
              optimal_max: true,
              sort_order: true,
            },
          },
        },
      },
    },
  })

  if (!record) {
    return NextResponse.json({ error: '检测记录不存在' }, { status: 404 })
  }

  return NextResponse.json({ record })
}