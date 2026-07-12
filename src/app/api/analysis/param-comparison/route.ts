import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireDataScopeResource } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const access = await requireDataScopeResource('param_analysis')
    if (access instanceof Response) return access
    const { searchParams } = req.nextUrl
    const paramAId = searchParams.get('paramA_id')
    const paramBId = searchParams.get('paramB_id')
    const categoryId = searchParams.get('category_id')
    const equipmentId = searchParams.get('equipment_id')
    const partRevisionId = searchParams.get('part_revision_id')

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

    // ── 2. 查找同一检测记录、同一零件版本中同时包含的两个参数 ──
    // 参数约束分别由 paramA_id / paramB_id 提供；连接键为 record_id + part_revision_id + 当前参数对。
    // 当前 Quality Scope 覆盖全部质量数据；all / quality 均可直接查询质量对象。
    const scopeWhere: Prisma.inspection_data_itemWhereInput =
      access.scope === 'all' || access.scope === 'quality'
        ? {}
        : { id: { equals: '__forbidden__' } }

    // 基础 where 条件
    const whereBase: Prisma.inspection_data_itemWhereInput = {
      ...scopeWhere,
      record: {
        ...(equipmentId ? { equipment_id: equipmentId } : {}),
      },
      ...(categoryId
        ? {
            part: { category_id: categoryId },
          }
        : {}),
      // 历史未知版本保留在台账中，但不参与基于零件版本的参数对比。
      part_revision_id: partRevisionId ?? { not: null },
    }

    // 取 paramA 的所有数据项（含关联）
    const itemsA = await db.inspection_data_item.findMany({
      where: { ...whereBase, param_item_id: paramAId, value_number: { not: null } },
      select: {
        record_id: true,
        part_revision_id: true,
        value_number: true,
        is_qualified: true,
        part: { select: { code: true, name: true } },
        part_revision: { select: { revision_no: true, drawing_no: true } },
        record: { select: { record_no: true } },
      },
    })

    const buildMatchKey = (recordId: string, revisionId: string) =>
      [recordId, revisionId, paramAId, paramBId].join(':')

    // 按 record_id + part_revision_id + 当前参数对建 map。
    const mapA = new Map<string, (typeof itemsA)[number]>()
    for (const item of itemsA) {
      if (!item.part_revision_id) continue
      mapA.set(buildMatchKey(item.record_id, item.part_revision_id), item)
    }

    // 取 paramB 的所有数据项
    const itemsB = await db.inspection_data_item.findMany({
      where: { ...whereBase, param_item_id: paramBId, value_number: { not: null } },
      select: {
        record_id: true,
        part_revision_id: true,
        value_number: true,
        is_qualified: true,
        part: { select: { code: true, name: true } },
        part_revision: { select: { revision_no: true, drawing_no: true } },
        record: { select: { record_no: true } },
      },
    })

    // 内连接：只保留同一 record、同一零件版本中两个参数都有数据的记录。
    interface DataPoint {
      valueA: number
      valueB: number
      isQualified: boolean
      partCode: string
      revisionNo: string | null
      drawingNo: string | null
      recordNo: string
    }

    const dataPoints: DataPoint[] = []
    const valuesA: number[] = []
    const valuesB: number[] = []

    for (const itemB of itemsB) {
      if (!itemB.part_revision_id) continue
      const itemA = mapA.get(buildMatchKey(itemB.record_id, itemB.part_revision_id))
      if (!itemA || itemA.value_number == null || itemB.value_number == null) continue

      const vA = itemA.value_number
      const vB = itemB.value_number

      dataPoints.push({
        valueA: vA,
        valueB: vB,
        isQualified: itemA.is_qualified === true && itemB.is_qualified === true,
        partCode: itemA.part.code,
        revisionNo: itemA.part_revision?.revision_no ?? null,
        drawingNo: itemA.part_revision?.drawing_no ?? null,
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
