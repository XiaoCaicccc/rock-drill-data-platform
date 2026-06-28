import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

// ─── 核心查询逻辑（导出供 /api/export 复用） ───

export async function getDashboardData() {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // ─── 并行查询 ───
  const [
    totalInspections,
    thisMonthRecords,
    allDataItems,
    thisMonthDataItems,
    lastMonthDataItems,
    monthlyTrendRaw,
    categoryAgg,
    equipmentAgg,
    recentRecords,
  ] = await Promise.all([
    // 1. 检测总量
    db.inspection_record.count(),

    // 2. 本月检测记录数
    db.inspection_record.count({
      where: { inspection_date: { gte: thisMonthStart } },
    }),

    // 3. 累计合格率（全量 data_items）
    db.inspection_data_item.groupBy({
      by: ['is_qualified'],
      where: { is_qualified: { not: null } },
      _count: { is_qualified: true },
    }),

    // 4. 本月合格率
    db.inspection_data_item.groupBy({
      by: ['is_qualified'],
      where: {
        is_qualified: { not: null },
        record: { inspection_date: { gte: thisMonthStart } },
      },
      _count: { is_qualified: true },
    }),

    // 5. 上月合格率（用于环比）
    db.inspection_data_item.groupBy({
      by: ['is_qualified'],
      where: {
        is_qualified: { not: null },
        record: { inspection_date: { gte: lastMonthStart, lte: lastMonthEnd } },
      },
      _count: { is_qualified: true },
    }),

    // 6. 近 6 个月趋势
    db.$queryRaw<
      { month: string; count: bigint; qualified: bigint }[]
    >(Prisma.sql`
      SELECT
        TO_CHAR(r.inspection_date, 'YYYY-MM') AS month,
        COUNT(*) AS count,
        SUM(CASE WHEN di.is_qualified = true THEN 1 ELSE 0 END) AS qualified
      FROM inspection_record r
      JOIN inspection_data_item di ON di.record_id = r.id
      WHERE r.inspection_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '6 months'
      GROUP BY TO_CHAR(r.inspection_date, 'YYYY-MM')
      ORDER BY month ASC
    `),

    // 7. 按类别合格率
    db.$queryRaw<
      { name: string; code: string; qualified: bigint; total: bigint }[]
    >(Prisma.sql`
      SELECT
        pc.name,
        pc.code,
        SUM(CASE WHEN di.is_qualified = true THEN 1 ELSE 0 END) AS qualified,
        COUNT(*) AS total
      FROM inspection_data_item di
      JOIN part p ON p.id = di.part_id
      JOIN part_category pc ON pc.id = p.category_id
      GROUP BY pc.id, pc.name, pc.code
      ORDER BY pc.code ASC
    `),

    // 8. 设备健康度（每台设备最近一次检测的合格率）
    db.$queryRaw<
      {
        equipmentId: string
        machineNo: string
        lastInspectionDate: Date
        qualified: bigint
        total: bigint
      }[]
    >(Prisma.sql`
      SELECT
        e.id AS "equipmentId",
        e.machine_no AS "machineNo",
        r.inspection_date AS "lastInspectionDate",
        SUM(CASE WHEN di.is_qualified = true THEN 1 ELSE 0 END) AS qualified,
        COUNT(*) AS total
      FROM equipment e
      JOIN inspection_record r ON r.equipment_id = e.id
      JOIN inspection_data_item di ON di.record_id = r.id
      WHERE r.id = (
        SELECT r2.id FROM inspection_record r2
        WHERE r2.equipment_id = e.id
        ORDER BY r2.inspection_date DESC
        LIMIT 1
      )
      GROUP BY e.id, e.machine_no, r.inspection_date
      ORDER BY e.machine_no ASC
    `),

    // 9. 最近 8 条检测记录
    db.inspection_record.findMany({
      take: 8,
      orderBy: { inspection_date: 'desc' },
      include: {
        equipment: { select: { id: true, machine_no: true, model: true } },
        _count: { select: { data_items: true } },
      },
    }),
  ])

  // ─── 计算合格率辅助函数 ───
  const calcRate = (items: { is_qualified: boolean; _count: { is_qualified: number } }[]) => {
    const total = items.reduce((s, i) => s + i._count.is_qualified, 0)
    const qualified = items
      .filter(i => i.is_qualified)
      .reduce((s, i) => s + i._count.is_qualified, 0)
    return total === 0 ? 0 : Math.round((qualified / total) * 1000) / 10
  }

  // ─── 1. 合格率计算 ───
  const overallQualifiedRate = calcRate(allDataItems)
  const thisMonthQualifiedRate = calcRate(thisMonthDataItems)
  const lastMonthQualifiedRate = calcRate(lastMonthDataItems)

  // ─── 2. 环比 ───
  const rateDiff = lastMonthQualifiedRate > 0
    ? Math.round((thisMonthQualifiedRate - lastMonthQualifiedRate) * 10) / 10
    : 0

  // ─── 3. 待办事项数 ───
  const pendingTasks = await db.task.count({
    where: { status: { in: ['待办', '进行中'] } },
  })

  // ─── 4. 月度趋势格式化 ───
  const monthlyTrend = (monthlyTrendRaw as { month: string; count: bigint; qualified: bigint }[]).map(r => ({
    month: r.month.slice(5),
    count: Number(r.count),
    qualifiedRate: r.count > 0 ? Math.round((Number(r.qualified) / Number(r.count)) * 1000) / 10 : 0,
  }))

  // ─── 5. 类别合格率 ───
  const categoryRates = (categoryAgg as { name: string; code: string; qualified: bigint; total: bigint }[]).map(r => ({
    name: r.name,
    code: r.code,
    qualifiedRate: r.total > 0 ? Math.round((Number(r.qualified) / Number(r.total)) * 1000) / 10 : 0,
  }))

  // ─── 6. 设备健康度 ───
  const equipmentHealth = (equipmentAgg as { equipmentId: string; machineNo: string; lastInspectionDate: Date; qualified: bigint; total: bigint }[]).map(r => ({
    equipmentId: r.equipmentId,
    machineNo: r.machineNo,
    lastInspectionDate: r.lastInspectionDate instanceof Date ? r.lastInspectionDate.toISOString() : String(r.lastInspectionDate),
    qualifiedRate: r.total > 0 ? Math.round((Number(r.qualified) / Number(r.total)) * 1000) / 10 : 0,
  }))

  // ─── 7. 最近检测记录 ───
  const recentInspections = recentRecords.map(r => ({
    id: r.id,
    record_no: r.record_no,
    inspector: r.inspector,
    inspection_date: r.inspection_date,
    overall_result: r.overall_result,
    batch_no: r.batch_no,
    equipment: r.equipment ? { machine_no: r.equipment.machine_no, model: r.equipment.model } : null,
    dataItemCount: r._count.data_items,
  }))

  return {
    totalInspections,
    thisMonthInspections: thisMonthRecords,
    overallQualifiedRate,
    thisMonthQualifiedRate,
    rateDiff,
    categoryRates,
    monthlyTrend,
    equipmentHealth,
    recentInspections,
    pendingTasks,
  }
}

export async function GET() {
  try {
    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取仪表盘数据失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}