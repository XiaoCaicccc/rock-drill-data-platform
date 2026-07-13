import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  ReportWorkflowError,
  transitionReportInTransaction,
  type ReportSourceScopeValidator,
} from '@/lib/report-workflow'

const routeParamsSchema = z.object({
  id: z.string().min(1, '缺少报告 ID'),
})

/** 发布前的最小来源标识；后续报告编辑接口负责写入该上下文。 */
const sourceContextSchema = z.object({
  inspection_record_ids: z.array(z.string().min(1)).min(1),
  analysis_identifiers: z.array(z.string().min(1)).min(1),
}).passthrough()

/**
 * 提交评审必须确认引用的质量对象仍存在于当前可访问的质量范围内。
 * 本端点只有 admin 与 quality_manager 能通过工作流写权限；两者均覆盖
 * 当前阶段的 Quality Scope，因此不从客户端接收任何范围或用户标识。
 */
function createSourceScopeValidator(
  scope: 'all' | 'quality' | 'published_reports' | 'dashboard_only',
): ReportSourceScopeValidator {
  return async (tx, { source_context, part_revision_ids }) => {
    if (scope !== 'all' && scope !== 'quality') {
      throw new ReportWorkflowError('当前数据范围不允许提交报告评审', 403)
    }

    const sourceContext = sourceContextSchema.safeParse(source_context)
    if (!sourceContext.success) {
      throw new ReportWorkflowError('提交评审必须包含可追溯的来源检测记录和分析标识', 422)
    }

    const revisionIds = [...new Set(part_revision_ids)]
    if (revisionIds.length === 0) {
      throw new ReportWorkflowError('提交评审必须关联已发布的零件版本', 422)
    }

    const inspectionRecordIds = [...new Set(sourceContext.data.inspection_record_ids)]
    const [revisions, inspectionRecords] = await Promise.all([
      tx.part_revision.findMany({
        where: { id: { in: revisionIds }, lifecycle_state: 'released' },
        select: { id: true },
      }),
      tx.inspection_record.findMany({
        where: { id: { in: inspectionRecordIds } },
        select: { id: true },
      }),
    ])

    if (revisions.length !== revisionIds.length) {
      throw new ReportWorkflowError('报告引用了不存在或未发布的零件版本', 422)
    }
    if (inspectionRecords.length !== inspectionRecordIds.length) {
      throw new ReportWorkflowError('报告引用了不存在的检测记录', 422)
    }
  }
}

// POST /api/reports/[id]/submit-review — 草稿提交至审核中。
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireDataScopeResource('reports')
  if (access instanceof Response) return access

  const params = routeParamsSchema.safeParse(await context.params)
  if (!params.success) {
    return NextResponse.json({ error: params.error.issues[0]?.message ?? '报告 ID 格式错误' }, { status: 400 })
  }

  try {
    await db.$transaction((tx) => transitionReportInTransaction(tx, {
      reportId: params.data.id,
      actor: access.session.user,
      targetStatus: 'reviewing',
      request,
      validateSourceScope: createSourceScopeValidator(access.scope),
    }))

    return NextResponse.json({ success: true, status: '审核中' })
  } catch (error) {
    if (error instanceof ReportWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[POST /api/reports/[id]/submit-review]', error)
    return NextResponse.json({ error: '提交评审失败' }, { status: 500 })
  }
}
