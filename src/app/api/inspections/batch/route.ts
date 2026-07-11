import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

interface BatchItem {
  part_revision_id: string
  param_item_id: string
  value_number: number | null
  value_text: string | null
}

// POST — 新检测数据必须绑定已发布的零件版本。
export async function POST(request: NextRequest) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer', 'inspector'])
    if (access instanceof Response) return access
    const body = await request.json()
    const { record, items } = body as { record: { equipment_id?: string; inspector: string; batch_no?: string; inspection_date: string; remark?: string }; items: BatchItem[] }

    if (!record?.inspector?.trim() || !record.inspection_date) return NextResponse.json({ error: '检测人员和检测日期不能为空' }, { status: 400 })
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: '检测数据不能为空' }, { status: 400 })
    if (record.equipment_id && !await db.equipment.findUnique({ where: { id: record.equipment_id } })) return NextResponse.json({ error: '设备不存在' }, { status: 400 })

    const revisionIds = [...new Set(items.map((item) => item.part_revision_id))]
    const paramItemIds = [...new Set(items.map((item) => item.param_item_id))]
    const [revisions, paramItems] = await Promise.all([
      db.part_revision.findMany({ where: { id: { in: revisionIds } }, select: { id: true, part_id: true, lifecycle_state: true } }),
      db.parameter_item.findMany({ where: { id: { in: paramItemIds } }, select: { id: true, standard_min: true, standard_max: true, optimal_min: true, optimal_max: true } }),
    ])
    const revisionMap = new Map(revisions.map((revision) => [revision.id, revision]))
    const parameterMap = new Map(paramItems.map((parameter) => [parameter.id, parameter]))

    const processedItems = items.map((item) => {
      const revision = revisionMap.get(item.part_revision_id)
      if (!revision) throw new Error('零件版本不存在')
      if (revision.lifecycle_state !== 'released') throw new Error('检测数据只能引用已发布的零件版本')
      const parameter = parameterMap.get(item.param_item_id)
      if (!parameter) throw new Error('参数项不存在')
      const value = item.value_number
      const isQualified = value == null || parameter.standard_min == null || parameter.standard_max == null
        ? null : value >= parameter.standard_min && value <= parameter.standard_max
      const isOptimal = value == null || parameter.optimal_min == null || parameter.optimal_max == null
        ? null : value >= parameter.optimal_min && value <= parameter.optimal_max
      return { part_id: revision.part_id, part_revision_id: revision.id, param_item_id: item.param_item_id, value_number: value, value_text: item.value_text || null, is_qualified: isQualified, is_optimal: isOptimal }
    })

    const checked = processedItems.filter((item) => item.is_qualified !== null)
    const overallResult = checked.length === 0 ? '待检' : checked.every((item) => item.is_qualified) ? '合格' : '不合格'
    const datePrefix = `JC-${record.inspection_date.slice(0, 10).replace(/-/g, '')}-`
    const inspectionRecord = await db.$transaction(async (tx) => {
      const count = await tx.inspection_record.count({ where: { record_no: { startsWith: datePrefix } } })
      const recordNo = `${datePrefix}${String(count + 1).padStart(3, '0')}`
      return tx.inspection_record.create({
        data: { record_no: recordNo, equipment_id: record.equipment_id || null, inspector: record.inspector.trim(), batch_no: record.batch_no?.trim() || null, inspection_date: new Date(record.inspection_date), overall_result: overallResult, remark: record.remark?.trim() || null, user_id: access.user.id, data_items: { createMany: { data: processedItems } } },
        include: { data_items: true },
      })
    }, { isolationLevel: 'Serializable' })

    await logAudit({ userId: access.user.id, action: 'CREATE', entityType: 'inspection_record', entityId: inspectionRecord.id, after: { record_no: inspectionRecord.record_no, item_count: processedItems.length }, request })
    return NextResponse.json({ record: inspectionRecord, message: `检测记录 ${inspectionRecord.record_no} 已保存，共 ${processedItems.length} 条数据` }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存检测数据失败'
    const status = message.includes('只能引用') ? 409 : 400
    console.error('[POST /api/inspections/batch]', error)
    return NextResponse.json({ error: message }, { status })
  }
}
