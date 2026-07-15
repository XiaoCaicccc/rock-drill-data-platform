import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  buildInspectionRecordFilters,
  normalizeInspectionFilterParams,
} from '@/lib/inspection-filters'

// ─── GET: 检测记录列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const access = await requireDataScopeResource('inspection_ledger')
  if (access instanceof Response) return access

  const { searchParams } = new URL(request.url)
  const filters = normalizeInspectionFilterParams(searchParams)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))

  const { where: filterWhere, error: filterError } = buildInspectionRecordFilters(filters)
  if (filterError === 'invalid_date') {
    return NextResponse.json({ error: '日期格式无效' }, { status: 400 })
  }
  if (filterError === 'invalid_date_range') {
    return NextResponse.json({ error: '起始日期不能晚于结束日期' }, { status: 400 })
  }

  // 当前 Quality Scope 覆盖全部检测质量数据；all / quality 均在查询前进入该范围。
  const scopeWhere: Prisma.inspection_recordWhereInput =
    access.scope === 'all' || access.scope === 'quality'
      ? {}
      : { id: { equals: '__forbidden__' } }

  const where: Prisma.inspection_recordWhereInput = {
    ...scopeWhere,
    ...filterWhere,
  }

  const [total, records] = await Promise.all([
    db.inspection_record.count({ where }),
    db.inspection_record.findMany({
      where,
      include: {
        equipment: { select: { id: true, machine_no: true, model: true } },
        data_items: {
          select: {
            part: {
              select: {
                code: true,
                name: true,
                category: { select: { id: true, name: true, code: true } },
              },
            },
            part_revision: { select: { revision_no: true, drawing_no: true } },
          },
        },
        _count: { select: { data_items: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const responseRecords = records.map((record) => ({
    ...record,
    part_versions: Array.from(new Map(record.data_items.map((item) => {
      const label = item.part_revision
        ? `${item.part.code} ${item.part.name} V${item.part_revision.revision_no}`
        : `${item.part.code} ${item.part.name} 未知版本`
      return [label, { ...item.part, revision_no: item.part_revision?.revision_no ?? null, drawing_no: item.part_revision?.drawing_no ?? null }]
    })).values()),
  }))
  return NextResponse.json({ records: responseRecords, total, page, pageSize })
}
