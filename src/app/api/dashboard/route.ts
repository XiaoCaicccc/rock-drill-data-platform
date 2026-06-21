import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/dashboard - 获取仪表盘统计数据
export async function GET() {
  try {
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    // 基础统计
    const [
      totalInspections,
      totalParts,
      totalCategories,
      pendingReports,
    ] = await Promise.all([
      db.inspectionRecord.count(),
      db.part.count(),
      db.partCategory.count(),
      db.analysisReport.count({ where: { status: '草稿' } }),
    ])

    // 本月检测数和合格率
    const thisMonthInspections = await db.inspectionRecord.count({
      where: { inspectionDate: { gte: thisMonthStart } }
    })

    const thisMonthQualified = await db.inspectionRecord.count({
      where: {
        inspectionDate: { gte: thisMonthStart },
        result: '合格',
      }
    })

    // 上月检测数和合格率
    const lastMonthInspections = await db.inspectionRecord.count({
      where: {
        inspectionDate: { gte: lastMonthStart, lt: thisMonthStart }
      }
    })

    const lastMonthQualified = await db.inspectionRecord.count({
      where: {
        inspectionDate: { gte: lastMonthStart, lt: thisMonthStart },
        result: '合格',
      }
    })

    // 总合格率
    const totalQualified = await db.inspectionRecord.count({
      where: { result: '合格' }
    })

    // 近3个月各月检测数量趋势
    const monthlyTrend = await db.inspectionRecord.groupBy({
      by: ['inspectionDate'],
      where: { inspectionDate: { gte: threeMonthsAgo } },
      _count: true,
    })

    // 按月分组
    const monthlyData: Record<string, { total: number; qualified: number; unqualified: number }> = {}
    monthlyTrend.forEach(item => {
      const key = `${item.inspectionDate.getFullYear()}-${String(item.inspectionDate.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData[key]) monthlyData[key] = { total: 0, qualified: 0, unqualified: 0 }
      monthlyData[key].total += item._count
    })

    // 各月合格/不合格数量
    const monthlyResults = await db.inspectionRecord.findMany({
      where: { inspectionDate: { gte: threeMonthsAgo } },
      select: { inspectionDate: true, result: true },
    })

    monthlyResults.forEach(item => {
      const key = `${item.inspectionDate.getFullYear()}-${String(item.inspectionDate.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData[key]) monthlyData[key] = { total: 0, qualified: 0, unqualified: 0 }
      if (item.result === '合格') {
        monthlyData[key].qualified++
      } else {
        monthlyData[key].unqualified++
      }
    })

    const trendChartData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        passRate: data.total > 0 ? Math.round((data.qualified / data.total) * 10000) / 100 : 0,
      }))

    // 按零部件类别统计合格率
    const categoryStats = await db.inspectionRecord.findMany({
      include: { part: { include: { category: true } } },
      where: { inspectionDate: { gte: threeMonthsAgo } },
    })

    const categoryMap: Record<string, { name: string; total: number; qualified: number }> = {}
    categoryStats.forEach(item => {
      const catId = item.part.category.id
      if (!categoryMap[catId]) {
        categoryMap[catId] = { name: item.part.category.name, total: 0, qualified: 0 }
      }
      categoryMap[catId].total++
      if (item.result === '合格') categoryMap[catId].qualified++
    })

    const categoryChartData = Object.values(categoryMap).map(cat => ({
      ...cat,
      passRate: cat.total > 0 ? Math.round((cat.qualified / cat.total) * 10000) / 100 : 0,
    }))

    // 按供应商统计
    const supplierStats = await db.inspectionRecord.findMany({
      include: { part: true },
      where: { inspectionDate: { gte: threeMonthsAgo } },
    })

    const supplierMap: Record<string, { name: string; total: number; qualified: number }> = {}
    supplierStats.forEach(item => {
      const supplier = item.part.supplier || '未知'
      if (!supplierMap[supplier]) {
        supplierMap[supplier] = { name: supplier, total: 0, qualified: 0 }
      }
      supplierMap[supplier].total++
      if (item.result === '合格') supplierMap[supplier].qualified++
    })

    const supplierChartData = Object.values(supplierMap).map(s => ({
      ...s,
      passRate: s.total > 0 ? Math.round((s.qualified / s.total) * 10000) / 100 : 0,
    }))

    // 硬度分布统计
    const hardnessRecords = await db.inspectionRecord.findMany({
      where: {
        inspectionDate: { gte: threeMonthsAgo },
        hardness: { not: null },
      },
      select: { hardness: true },
    })

    const hardnessRanges = [
      { range: '35-40', min: 35, max: 40 },
      { range: '40-45', min: 40, max: 45 },
      { range: '45-50', min: 45, max: 50 },
      { range: '50-55', min: 50, max: 55 },
      { range: '55-60', min: 55, max: 60 },
    ]

    const hardnessData = hardnessRanges.map(r => ({
      range: r.range,
      count: hardnessRecords.filter(h => h.hardness! >= r.min && h.hardness! < r.max).length,
    }))

    // 待办任务数
    const pendingTasks = await db.task.count({
      where: { status: { in: ['待办', '进行中'] } }
    })

    // 最近检测记录
    const recentInspections = await db.inspectionRecord.findMany({
      include: { part: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    return NextResponse.json({
      kpi: {
        totalInspections,
        totalParts,
        totalCategories,
        pendingReports,
        thisMonthInspections,
        thisMonthPassRate: thisMonthInspections > 0
          ? Math.round((thisMonthQualified / thisMonthInspections) * 10000) / 100
          : 0,
        lastMonthPassRate: lastMonthInspections > 0
          ? Math.round((lastMonthQualified / lastMonthInspections) * 10000) / 100
          : 0,
        totalPassRate: totalInspections > 0
          ? Math.round((totalQualified / totalInspections) * 10000) / 100
          : 0,
        pendingTasks,
      },
      trendChartData,
      categoryChartData,
      supplierChartData,
      hardnessData,
      recentInspections,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取仪表盘数据失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}