import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireDataScopeResource } from '@/lib/permissions'

// ─── GET: 检测记录列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const access = await requireDataScopeResource('inspection_ledger')
  if (access instanceof Response) return access

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? searchParams.get('keyword') ?? ''
  const categoryId = searchParams.get('categoryId') ?? ''
  const resultFilter = searchParams.get('result') ?? searchParams.get('status') ?? ''
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))

  const parseDate = (value: string, endOfDay: boolean) => {
    if (!value) return null
    const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const start = parseDate(startDate, false)
  const end = parseDate(endDate, true)
  if ((startDate && !start) || (endDate && !end)) {
    return NextResponse.json({ error: '日期格式无效' }, { status: 400 })
  }
  if (start && end && start > end) {
    return NextResponse.json({ error: '起始日期不能晚于结束日期' }, { status: 400 })
  }

  // 当前 Quality Scope 覆盖全部检测质量数据；all / quality 均在查询前进入该范围。
  const scopeWhere: Prisma.inspection_recordWhereInput =
    access.scope === 'all' || access.scope === 'quality'
      ? {}
      : { id: { equals: '__forbidden__' } }

  const where: Prisma.inspection_recordWhereInput = {
    ...scopeWhere,
    ...(search
      ? {
          OR: [
            { record_no: { contains: search, mode: 'insensitive' } },
            { inspector: { contains: search, mode: 'insensitive' } },
            { batch_no: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(resultFilter ? { overall_result: resultFilter } : {}),
    ...(categoryId
      ? {
          data_items: {
            some: { part: { category_id: categoryId } },
          },
        }
      : {}),
    ...(start || end
      ? {
          inspection_date: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
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
