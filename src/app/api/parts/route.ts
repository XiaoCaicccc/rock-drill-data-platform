import { NextRequest, NextResponse } from 'next/server'
import { PartLifecycleState, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { applyDataScope, requireAuth, requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

function asOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asKeyCharacteristics(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'object') throw new Error('关键特性必须为 JSON 对象或数组')
  return value as Prisma.InputJsonValue
}

const CRITICALITIES = ['normal', 'important', 'critical'] as const

// GET — 返回主数据、当前已发布版本及最新版本摘要。
export async function GET(request: NextRequest) {
  try {
    const access = await requireAuth()
    if (access instanceof Response) return access

    const { searchParams } = request.nextUrl
    const keyword = searchParams.get('keyword')?.trim()
    const lifecycleState = searchParams.get('lifecycle_state')?.trim()
    const categoryId = searchParams.get('category_id')?.trim()
    const where: Prisma.partWhereInput = applyDataScope(access, {})

    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { current_revision: { is: { drawing_no: { contains: keyword, mode: 'insensitive' } } } },
        { current_revision: { is: { specification: { contains: keyword, mode: 'insensitive' } } } },
      ]
    }
    if (categoryId) where.category_id = categoryId
    if (lifecycleState && Object.values(PartLifecycleState).includes(lifecycleState as PartLifecycleState)) {
      where.current_revision = { is: { lifecycle_state: lifecycleState as PartLifecycleState } }
    }

    const parts = await db.part.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, code: true } },
        current_revision: true,
        revisions: { orderBy: { revision_seq: 'desc' }, take: 1 },
        _count: { select: { data_items: true } },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({
      parts: parts.map((part) => ({
        id: part.id,
        code: part.code,
        name: part.name,
        category_id: part.category_id,
        category_name: part.category.name,
        category_code: part.category.code,
        install_date: part.install_date?.toISOString().slice(0, 10) ?? null,
        working_hours: part.working_hours,
        is_active: part.is_active,
        current_revision: part.current_revision,
        latest_revision: part.revisions[0] ?? null,
        data_item_count: part._count.data_items,
      })),
    })
  } catch (error) {
    console.error('[GET /api/parts]', error)
    return NextResponse.json({ error: '获取零件列表失败' }, { status: 500 })
  }
}

// POST — 创建稳定主数据和首个草稿版本。
export async function POST(request: NextRequest) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const body = await request.json()

    if (!asOptionalText(body.code)) return NextResponse.json({ error: '零件编号不能为空' }, { status: 400 })
    if (!asOptionalText(body.name)) return NextResponse.json({ error: '零件名称不能为空' }, { status: 400 })
    if (!body.category_id) return NextResponse.json({ error: '请选择零件类别' }, { status: 400 })
    if (body.criticality && !CRITICALITIES.includes(body.criticality)) {
      return NextResponse.json({ error: '关键性字段不合法' }, { status: 400 })
    }

    const [existing, category] = await Promise.all([
      db.part.findUnique({ where: { code: body.code.trim() } }),
      db.part_category.findUnique({ where: { id: body.category_id } }),
    ])
    if (existing) return NextResponse.json({ error: `零件编号 "${body.code}" 已存在` }, { status: 409 })
    if (!category) return NextResponse.json({ error: '所选类别不存在' }, { status: 400 })

    let keyCharacteristics: Prisma.InputJsonValue | null
    try {
      keyCharacteristics = asKeyCharacteristics(body.key_characteristics)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : '关键特性格式错误' }, { status: 400 })
    }

    const created = await db.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          code: body.code.trim(),
          name: body.name.trim(),
          category_id: body.category_id,
          install_date: body.install_date ? new Date(body.install_date) : null,
          working_hours: Number(body.working_hours) || 0,
          is_active: body.is_active !== false,
          created_by: access.user.id,
        },
      })
      const revision = await tx.part_revision.create({
        data: {
          part_id: part.id,
          revision_no: '01',
          revision_seq: 1,
          drawing_no: asOptionalText(body.drawing_no),
          unit: asOptionalText(body.unit),
          specification: asOptionalText(body.specification),
          material: asOptionalText(body.material),
          supplier: asOptionalText(body.supplier),
          criticality: body.criticality ?? 'normal',
          key_characteristics: keyCharacteristics ?? undefined,
          change_summary: asOptionalText(body.change_summary) ?? '首版草稿',
          remark: asOptionalText(body.remark),
          created_by: access.user.id,
        },
      })
      return { part, revision }
    })

    await logAudit({
      userId: access.user.id,
      action: 'CREATE',
      entityType: 'part',
      entityId: created.part.id,
      after: { code: created.part.code, revision_no: created.revision.revision_no },
      request,
    })
    return NextResponse.json({ part: created.part, revision: created.revision }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '零件编号或图号已存在' }, { status: 409 })
    }
    console.error('[POST /api/parts]', error)
    return NextResponse.json({ error: '创建零件失败' }, { status: 500 })
  }
}

// DELETE — 历史检测数据存在时禁止删除。
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireRole(['admin', 'quality_manager', 'engineer'])
    if (access instanceof Response) return access
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少零件 ID' }, { status: 400 })

    const current = await db.part.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: '零件不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(current.created_by)
    if (ownership instanceof Response) return ownership

    const dataItemCount = await db.inspection_data_item.count({ where: { part_id: id } })
    if (dataItemCount > 0) {
      return NextResponse.json({ error: `该零件下尚有 ${dataItemCount} 条检测数据，不能删除` }, { status: 409 })
    }

    await db.part.delete({ where: { id } })
    await logAudit({ userId: access.user.id, action: 'DELETE', entityType: 'part', entityId: id, before: { code: current.code }, request })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/parts]', error)
    return NextResponse.json({ error: '删除零件失败' }, { status: 500 })
  }
}
