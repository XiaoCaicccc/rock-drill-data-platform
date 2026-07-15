import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireDataScopeResource, type DataScopeType } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import {
  buildInspectionRecordFilters,
  normalizeInspectionFilterParams,
} from '@/lib/inspection-filters'

// ─── CSV 工具 ───

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[,"\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cells: unknown[]): string {
  return cells.map(escapeCsv).join(',') + '\n'
}

function todayStamp(): string {
  return format(new Date(), 'yyyyMMdd')
}

function qualityScopeWhere(scope: DataScopeType): Prisma.inspection_recordWhereInput {
  return scope === 'all' || scope === 'quality'
    ? {}
    : { id: '__forbidden__' }
}

// ─── GET: 数据导出 ───

export async function GET(request: NextRequest) {
  const access = await requireDataScopeResource('export')
  if (access instanceof Response) return access
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || ''

  try {
    if (type === 'inspections') {
      const response = await exportInspections(searchParams, access.scope)
      await logAudit({ userId: access.session.user.id, action: 'EXPORT', entityType: 'inspection_record', entityId: 'bulk', request, metadata: { type } })
      return response
    }
    if (type === 'dashboard') {
      const response = await exportDashboard(access.scope)
      await logAudit({ userId: access.session.user.id, action: 'EXPORT', entityType: 'dashboard', entityId: 'current', request, metadata: { type } })
      return response
    }
    return NextResponse.json({ error: '无效的导出类型，支持 inspections / dashboard' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : '导出失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── 导出检测台账 ───

async function exportInspections(params: URLSearchParams, scope: DataScopeType) {
  const filters = normalizeInspectionFilterParams(params, { includeLegacyDateAliases: true })
  const equipmentId = params.get('equipment_id') || ''
  const { where: filterWhere, error: filterError } = buildInspectionRecordFilters(filters)
  if (filterError === 'invalid_date') {
    throw new Error('日期格式无效')
  }
  if (filterError === 'invalid_date_range') {
    throw new Error('起始日期不能晚于结束日期')
  }

  const records = await db.inspection_record.findMany({
    where: {
      ...qualityScopeWhere(scope),
      ...filterWhere,
      ...(equipmentId ? { equipment_id: equipmentId } : {}),
    },
    include: {
      equipment: { select: { machine_no: true, model: true } },
      _count: { select: { data_items: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const header = csvRow([
    '检测编号', '设备编号', '设备型号', '检测人员', '检测日期',
    '批次号', '整体结果', '数据项数', '创建时间',
  ])

  const rows = records.map((r) => {
    const equipment = r.equipment
    const counts = r._count
    return csvRow([
      r.record_no,
      equipment?.machine_no ?? '',
      equipment?.model ?? '',
      r.inspector,
      format(r.inspection_date, 'yyyy-MM-dd'),
      r.batch_no ?? '',
      r.overall_result ?? '',
      counts?.data_items ?? 0,
      format(r.created_at, 'yyyy-MM-dd HH:mm'),
    ])
  })

  const csv = '\uFEFF' + header + rows.join('')
  const filename = `检测台账_${todayStamp()}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

// ─── 导出数据总览 ───

async function exportDashboard(scope: DataScopeType) {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const recordScope = qualityScopeWhere(scope)
  const [
    totalInspections,
    thisMonthInspections,
    qualifiedItems,
    thisMonthQualifiedItems,
    monthlyTrendRaw,
    records,
    equipment,
  ] = await Promise.all([
    db.inspection_record.count({ where: recordScope }),
    db.inspection_record.count({ where: { ...recordScope, inspection_date: { gte: thisMonthStart } } }),
    db.inspection_data_item.groupBy({
      by: ['is_qualified'],
      where: { is_qualified: { not: null }, record: recordScope },
      _count: { is_qualified: true },
    }),
    db.inspection_data_item.groupBy({
      by: ['is_qualified'],
      where: {
        is_qualified: { not: null },
        record: { ...recordScope, inspection_date: { gte: thisMonthStart } },
      },
      _count: { is_qualified: true },
    }),
    db.$queryRaw<
      { month: string; count: bigint; qualified: bigint }[]
    >(Prisma.sql`
      SELECT
        TO_CHAR(r.inspection_date, 'YYYY-MM') AS month,
        COUNT(*) AS count,
        SUM(CASE WHEN di.is_qualified = true THEN 1 ELSE 0 END) AS qualified
      FROM inspection_record r
      JOIN inspection_data_item di ON di.record_id = r.id
      WHERE r.inspection_date >= ${trendStart}
      GROUP BY TO_CHAR(r.inspection_date, 'YYYY-MM')
      ORDER BY month ASC
    `),
    db.inspection_record.findMany({
      select: {
        data_items: {
          select: {
            is_qualified: true,
            part: { select: { category: { select: { code: true, name: true } } } },
          },
        },
      },
      where: {
        ...recordScope,
        inspection_date: { gte: trendStart },
      },
      orderBy: { inspection_date: 'asc' },
    }),
    db.equipment.findMany({
      select: {
        machine_no: true,
        inspection_records: {
          take: 1,
          orderBy: { inspection_date: 'desc' },
          select: {
            inspection_date: true,
            data_items: { select: { is_qualified: true } },
          },
        },
      },
      where: scope === 'all' || scope === 'quality' ? {} : { id: '__forbidden__' },
      orderBy: { machine_no: 'asc' },
    }),
  ])

  const calculateRate = (items: typeof qualifiedItems) => {
    const total = items.reduce((sum, item) => sum + item._count.is_qualified, 0)
    const qualified = items
      .filter((item) => item.is_qualified === true)
      .reduce((sum, item) => sum + item._count.is_qualified, 0)
    return total === 0 ? 0 : Math.round((qualified / total) * 1000) / 10
  }

  const categories = new Map<string, { code: string; name: string; total: number; qualified: number }>()
  for (const record of records) {
    for (const item of record.data_items) {
      const category = item.part.category
      const categoryEntry = categories.get(category.code) ?? {
        code: category.code,
        name: category.name,
        total: 0,
        qualified: 0,
      }
      categoryEntry.total += 1
      if (item.is_qualified) categoryEntry.qualified += 1
      categories.set(category.code, categoryEntry)
    }
  }

  const pendingTasks = scope === 'all'
    ? await db.task.count({ where: { status: { in: ['待办', '进行中'] } } })
    : 0

  const data = {
    totalInspections,
    thisMonthInspections,
    overallQualifiedRate: calculateRate(qualifiedItems),
    thisMonthQualifiedRate: calculateRate(thisMonthQualifiedItems),
    monthlyTrend: monthlyTrendRaw.map((row) => ({
      month: row.month.slice(5),
      count: Number(row.count),
      qualifiedRate: row.count > 0 ? Math.round((Number(row.qualified) / Number(row.count)) * 1000) / 10 : 0,
    })),
    categoryRates: Array.from(categories.values())
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((value) => ({
        code: value.code,
        name: value.name,
        qualifiedRate: value.total === 0 ? 0 : Math.round((value.qualified / value.total) * 1000) / 10,
      })),
    equipmentHealth: equipment.flatMap((item) => {
      const latestRecord = item.inspection_records[0]
      if (!latestRecord) return []
      const total = latestRecord.data_items.length
      const qualified = latestRecord.data_items.filter((dataItem) => dataItem.is_qualified === true).length
      return [{
        machineNo: item.machine_no,
        lastInspectionDate: latestRecord.inspection_date,
        qualifiedRate: total === 0 ? 0 : Math.round((qualified / total) * 1000) / 10,
      }]
    }),
    pendingTasks,
  }

  // 月度趋势
  const trendHeader = csvRow(['月份', '检测数', '合格率(%)'])
  const trendRows = (data.monthlyTrend || []).map((r: Record<string, unknown>) =>
    csvRow([r.month, r.count, r.qualifiedRate]),
  )

  // 类别合格率
  const catHeader = csvRow(['类别编码', '类别名称', '合格率(%)'])
  const catRows = (data.categoryRates || []).map((r: Record<string, unknown>) =>
    csvRow([r.code, r.name, r.qualifiedRate]),
  )

  // 设备健康度
  const eqHeader = csvRow(['设备编号', '最近检测日期', '合格率(%)'])
  const eqRows = (data.equipmentHealth || []).map((r: Record<string, unknown>) =>
    csvRow([
      r.machineNo,
      r.lastInspectionDate ? format(new Date(r.lastInspectionDate as string), 'yyyy-MM-dd') : '',
      r.qualifiedRate,
    ]),
  )

  const csv =
    '\uFEFF' +
    csvRow([`数据总览 - 导出时间 ${format(new Date(), 'yyyy-MM-dd HH:mm')}`]) +
    csvRow(['检测总量', data.totalInspections]) +
    csvRow(['本月检测数', data.thisMonthInspections]) +
    csvRow(['本月合格率(%)', data.thisMonthQualifiedRate]) +
    csvRow(['累计合格率(%)', data.overallQualifiedRate]) +
    csvRow(['待办事项数', data.pendingTasks]) +
    '\n' +
    csvRow(['## 月度趋势']) +
    trendHeader +
    trendRows.join('') +
    '\n' +
    csvRow(['## 类别合格率']) +
    catHeader +
    catRows.join('') +
    '\n' +
    csvRow(['## 设备健康度']) +
    eqHeader +
    eqRows.join('')

  const filename = `数据总览_${todayStamp()}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
