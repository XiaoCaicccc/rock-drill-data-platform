import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
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
      db.$queryRawUnsafe<
        { month: string; count: number; qualified: number }[]
      >(`
        SELECT
          strftime('%Y-%m', r.inspection_date) AS month,
          COUNT(*) AS count,
          SUM(CASE WHEN di.is_qualified = 1 THEN 1 ELSE 0 END) AS qualified
        FROM inspection_record r
        JOIN inspection_data_item di ON di.record_id = r.id
        WHERE r.inspection_date >= date('now', '-6 months', 'start of month')
        GROUP BY strftime('%Y-%m', r.inspection_date)
        ORDER BY month ASC
      `) as Prisma.Sql,

      // 7. 按类别合格率
      db.$queryRawUnsafe<
        { name: string; code: string; qualified: number; total: number }[]
      >(`
        SELECT
          pc.name,
          pc.code,
          SUM(CASE WHEN di.is_qualified = 1 THEN 1 ELSE 0 END) AS qualified,
          COUNT(*) AS total
        FROM inspection_data_item di
        JOIN part p ON p.id = di.part_id
        JOIN part_category pc ON pc.id = p.category_id
        GROUP BY pc.id
        ORDER BY pc.code ASC
      `) as Prisma.Sql,

      // 8. 设备健康度（每台设备最近一次检测的合格率）
      db.$queryRawUnsafe<
        {
          equipmentId: string
          machineNo: string
          lastInspectionDate: string
          qualified: number
          total: number
        }[]
      >(`
        SELECT
          e.id AS equipmentId,
          e.machine_no AS machineNo,
          r.inspection_date AS lastInspectionDate,
          SUM(CASE WHEN di.is_qualified = 1 THEN 1 ELSE 0 END) AS qualified,
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
        GROUP BY e.id
        ORDER BY e.machine_no ASC
      `) as Prisma.Sql,

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
    const monthlyTrend = (monthlyTrendRaw as unknown as { month: string; count: number; qualified: number }[]).map(r => ({
      month: r.month.slice(5), // "06"
      count: r.count,
      qualifiedRate: r.count > 0 ? Math.round((r.qualified / r.count) * 1000) / 10 : 0,
    }))

    // ─── 5. 类别合格率 ───
    const categoryRates = (categoryAgg as unknown as { name: string; code: string; qualified: number; total: number }[]).map(r => ({
      name: r.name,
      code: r.code,
      qualifiedRate: r.total > 0 ? Math.round((r.qualified / r.total) * 1000) / 10 : 0,
    }))

    // ─── 6. 设备健康度 ───
    const equipmentHealth = (equipmentAgg as unknown as { equipmentId: string; machineNo: string; lastInspectionDate: string; qualified: number; total: number }[]).map(r => ({
      equipmentId: r.equipmentId,
      machineNo: r.machineNo,
      lastInspectionDate: r.lastInspectionDate,
      qualifiedRate: r.total > 0 ? Math.round((r.qualified / r.total) * 1000) / 10 : 0,
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

    return NextResponse.json({
      totalInspections,
      thisMonthInspections,
      overallQualifiedRate,
      thisMonthQualifiedRate,
      rateDiff,
      categoryRates,
      monthlyTrend,
      equipmentHealth,
      recentInspections,
      pendingTasks,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取仪表盘数据失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}