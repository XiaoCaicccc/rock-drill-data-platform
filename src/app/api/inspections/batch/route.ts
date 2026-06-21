import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ============================================================
// POST — batch create inspection_record + inspection_data_items
// ============================================================

interface BatchItem {
  part_id: string
  param_item_id: string
  value_number: number | null
  value_text: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { record, items } = body as {
      record: {
        equipment_id?: string
        inspector: string
        batch_no?: string
        inspection_date: string
        remark?: string
      }
      items: BatchItem[]
    }

    // --- Validate record ---
    if (!record) {
      return NextResponse.json({ error: '缺少检测记录信息' }, { status: 400 })
    }
    if (!record.inspector?.trim()) {
      return NextResponse.json({ error: '检测人员不能为空' }, { status: 400 })
    }
    if (!record.inspection_date) {
      return NextResponse.json({ error: '检测日期不能为空' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '检测数据不能为空' }, { status: 400 })
    }

    // --- Validate equipment ---
    if (record.equipment_id) {
      const equip = await db.equipment.findUnique({
        where: { id: record.equipment_id },
        select: { id: true },
      })
      if (!equip) {
        return NextResponse.json({ error: '设备不存在' }, { status: 400 })
      }
    }

    // --- Validate FK references ---
    const partIds = [...new Set(items.map((i: BatchItem) => i.part_id))]
    const paramItemIds = [...new Set(items.map((i: BatchItem) => i.param_item_id))]

    const [parts, paramItems] = await Promise.all([
      db.part.findMany({
        where: { id: { in: partIds } },
        select: { id: true },
      }),
      db.parameter_item.findMany({
        where: { id: { in: paramItemIds } },
        select: {
          id: true,
          standard_min: true,
          standard_max: true,
          optimal_min: true,
          optimal_max: true,
        },
      }),
    ])

    const partIdSet = new Set(parts.map((p) => p.id))
    const paramItemMap = new Map(paramItems.map((p) => [p.id, p]))

    for (const item of items) {
      if (!partIdSet.has(item.part_id)) {
        return NextResponse.json(
          { error: '零件不存在' },
          { status: 400 },
        )
      }
      if (!paramItemMap.has(item.param_item_id)) {
        return NextResponse.json(
          { error: '参数项不存在' },
          { status: 400 },
        )
      }
    }

    // --- Generate record_no: JC-YYYYMMDD-NNN ---
    const dateStr = record.inspection_date.slice(0, 10).replace(/-/g, '')
    const prefix = `JC-${dateStr}-`
    const existingCount = await db.inspection_record.count({
      where: { record_no: { startsWith: prefix } },
    })
    const recordNo = `${prefix}${String(existingCount + 1).padStart(3, '0')}`

    // --- Compute is_qualified / is_optimal per item ---
    const processedItems = items.map((item: BatchItem) => {
      const paramDef = paramItemMap.get(item.param_item_id)!

      let is_qualified: boolean | null = null
      let is_optimal: boolean | null = null

      if (item.value_number != null) {
        const v = item.value_number
        const sMin = paramDef.standard_min
        const sMax = paramDef.standard_max
        const oMin = paramDef.optimal_min
        const oMax = paramDef.optimal_max

        if (sMin != null && sMax != null) {
          is_qualified = v >= sMin && v <= sMax
        }
        if (oMin != null && oMax != null) {
          is_optimal = v >= oMin && v <= oMax
        }
      }

      return {
        part_id: item.part_id,
        param_item_id: item.param_item_id,
        value_number: item.value_number,
        value_text: item.value_text || null,
        is_qualified,
        is_optimal,
      }
    })

    // --- Overall result ---
    const checkedItems = processedItems.filter((i) => i.is_qualified !== null)
    const qualifiedCount = checkedItems.filter(
      (i) => i.is_qualified === true,
    ).length
    let overall_result = '待检'
    if (checkedItems.length > 0) {
      overall_result =
        qualifiedCount === checkedItems.length ? '合格' : '不合格'
    }

    // --- Create record + items (createMany) ---
    const inspectionRecord = await db.inspection_record.create({
      data: {
        record_no: recordNo,
        equipment_id: record.equipment_id || null,
        inspector: record.inspector.trim(),
        batch_no: record.batch_no?.trim() || null,
        inspection_date: new Date(record.inspection_date),
        overall_result,
        remark: record.remark?.trim() || null,
        data_items: {
          createMany: {
            data: processedItems,
          },
        },
      },
      include: { data_items: true },
    })

    return NextResponse.json(
      {
        record: inspectionRecord,
        message: `检测记录 ${recordNo} 已保存，共 ${processedItems.length} 条数据`,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/inspections/batch]', error)
    return NextResponse.json({ error: '保存检测数据失败' }, { status: 500 })
  }
}