import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const paramAId = searchParams.get('paramA_id')
    const paramBId = searchParams.get('paramB_id')
    const categoryId = searchParams.get('category_id')
    const equipmentId = searchParams.get('equipment_id')

    if (!paramAId || !paramBId) {
      return NextResponse.json(
        { error: 'paramA_id 和 paramB_id 为必填参数' },
        { status: 400 },
      )
    }
    if (paramAId === paramBId) {
      return NextResponse.json(
        { error: 'paramA_id 和 paramB_id 不能相同' },
        { status: 400 },
      )
    }

    // ── 1. 获取参数元信息 ──
    const [paramA, paramB] = await Promise.all([
      db.parameter_item.findUnique({ where: { id: paramAId } }),
      db.parameter_item.findUnique({ where: { id: paramBId } }),
    ])
    if (!paramA || !paramB) {
      return NextResponse.json(
        { error: '参数项不存在' },
        { status: 404 },
      )
    }

    const formatParam = (p: typeof paramA) => ({
      id: p.id,
      param_name: p.param_name,
      param_code: p.param_code,
      unit: p.unit ?? '',
    })

    // ── 2. 查找同时包含这两个参数的 record_id ──
    //    即同一检测记录中，这两条参数都有数据
    //    SQL 思路: inspection_data_item for paramA  INNER JOIN  inspection_data_item for paramB  ON record_id
    //    然后进一步按 category / equipment 过滤

    // 基础 where 条件
    const whereBase: Prisma.inspection_data_itemWhereInput = {
      record: {
        ...(equipmentId ? { equipment_id: equipmentId } : {}),
      },
      ...(categoryId
        ? {
            part: { category_id: categoryId },
          }
        : {}),
    }

    // 取 paramA 的所有数据项（含关联）
    const itemsA = await db.inspection_data_item.findMany({
      where: { ...whereBase, param_item_id: paramAId, value_number: { not: null } },
      select: {
        record_id: true,
        value_number: true,
        is_qualified: true,
        part: { select: { code: true } },
        record: { select: { record_no: true } },
      },
    })

    // 按 record_id 建 map
    const mapA = new Map<string, (typeof itemsA)[number]>()
    for (const item of itemsA) mapA.set(item.record_id, item)

    // 取 paramB 的所有数据项
    const itemsB = await db.inspection_data_item.findMany({
      where: { ...whereBase, param_item_id: paramBId, value_number: { not: null } },
      select: {
        record_id: true,
        value_number: true,
        is_qualified: true,
        part: { select: { code: true } },
        record: { select: { record_no: true } },
      },
    })

    // 内连接：只保留两个参数都有数据的 record
    interface DataPoint {
      valueA: number
      valueB: number
      isQualified: boolean
      partCode: string
      recordNo: string
    }

    const dataPoints: DataPoint[] = []
    const valuesA: number[] = []
    const valuesB: number[] = []

    for (const itemB of itemsB) {
      const itemA = mapA.get(itemB.record_id)
      if (!itemA || itemA.value_number == null || itemB.value_number == null) continue

      const vA = itemA.value_number
      const vB = itemB.value_number

      dataPoints.push({
        valueA: vA,
        valueB: vB,
        isQualified: itemA.is_qualified === true && itemB.is_qualified === true,
        partCode: itemA.part.code,
        recordNo: itemA.record.record_no,
      })
      valuesA.push(vA)
      valuesB.push(vB)
    }

    // ── 3. 皮尔逊相关系数 ──
    const n = valuesA.length
    let correlation: number | null = null

    if (n >= 2) {
      const sumX = valuesA.reduce((s, v) => s + v, 0)
      const sumY = valuesB.reduce((s, v) => s + v, 0)
      const sumXY = valuesA.reduce((s, v, i) => s + v * valuesB[i], 0)
      const sumX2 = valuesA.reduce((s, v) => s + v * v, 0)
      const sumY2 = valuesB.reduce((s, v) => s + v * v, 0)

      const numerator = n * sumXY - sumX * sumY
      const denominator = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
      )

      correlation = denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 10000
    }

    // ── 4. 直方图（10 等宽区间）──
    function buildHistogram(values: number[]): { rangeLabel: string; count: number }[] {
      if (values.length === 0) return []

      const min = Math.min(...values)
      const max = Math.max(...values)
      const range = max - min

      // 处理所有值相同的情况
      const binWidth = range === 0 ? 1 : range / 10
      const start = range === 0 ? min - 0.5 : min

      const bins = Array.from({ length: 10 }, (_, i) => ({
        lo: start + i * binWidth,
        hi: start + (i + 1) * binWidth,
        count: 0,
      }))

      for (const v of values) {
        let idx = Math.floor((v - start) / binWidth)
        if (idx < 0) idx = 0
        if (idx > 9) idx = 9
        bins[idx].count++
      }

      return bins.map((b) => ({
        rangeLabel: `${b.lo.toFixed(2)}~${b.hi.toFixed(2)}`,
        count: b.count,
      }))
    }

    const distributionA = buildHistogram(valuesA)
    const distributionB = buildHistogram(valuesB)

    // ── 5. 返回 ──
    return NextResponse.json({
      paramA: formatParam(paramA),
      paramB: formatParam(paramB),
      dataPoints,
      correlation,
      distributionA,
      distributionB,
    })
  } catch (error) {
    console.error('[Param Comparison API] Error:', error)
    return NextResponse.json(
      { error: '参数对比分析失败' },
      { status: 500 },
    )
  }
}
