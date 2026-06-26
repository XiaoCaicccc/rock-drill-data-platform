import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'

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

// ─── GET: 数据导出 ───

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || ''

  try {
    if (type === 'inspections') {
      return await exportInspections(searchParams)
    }
    if (type === 'dashboard') {
      return await exportDashboard()
    }
    return NextResponse.json({ error: '无效的导出类型，支持 inspections / dashboard' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : '导出失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── 导出检测台账 ───

async function exportInspections(params: URLSearchParams) {
  const qs = new URLSearchParams()
  const keyword = params.get('keyword') || ''
  const equipmentId = params.get('equipment_id') || ''
  const status = params.get('result') || ''
  const dateFrom = params.get('date_from') || ''
  const dateTo = params.get('date_to') || ''

  if (keyword) qs.set('keyword', keyword)
  if (status) qs.set('status', status)
  qs.set('pageSize', '9999')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/inspections?${qs}`)
  if (!res.ok) throw new Error('获取检测数据失败')
  const json = await res.json()
  const records = json.records || []

  const header = csvRow([
    '检测编号', '设备编号', '设备型号', '检测人员', '检测日期',
    '批次号', '整体结果', '数据项数', '创建时间',
  ])

  const rows = records.map((r: Record<string, unknown>) =>
    csvRow([
      r.record_no,
      r.equipment?.machine_no ?? '',
      r.equipment?.model ?? '',
      r.inspector,
      r.inspection_date ? format(new Date(r.inspection_date as string), 'yyyy-MM-dd') : '',
      r.batch_no ?? '',
      r.overall_result ?? '',
      r._count?.data_items ?? 0,
      r.created_at ? format(new Date(r.created_at as string), 'yyyy-MM-dd HH:mm') : '',
    ]),
  )

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

async function exportDashboard() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/dashboard`)
  if (!res.ok) throw new Error('获取仪表盘数据失败')
  const data = await res.json()

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