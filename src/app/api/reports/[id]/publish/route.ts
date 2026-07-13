import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireDataScopeResource, type DataScopeType } from '@/lib/permissions'
import {
  publishReport,
  ReportWorkflowError,
  type ReportSourceScopeValidator,
} from '@/lib/report-workflow'

const routeParamsSchema = z.object({
  id: z.string().min(1, '缺少报告 ID'),
})

const sourceContextSchema = z.object({
  inspection_record_ids: z.array(z.string().min(1)).min(1),
  analysis_identifiers: z.array(z.string().min(1)).min(1),
}).passthrough()

/**
 * 发布前在同一事务中确认报告来源属于当前可访问的 Quality Scope。
 * 生命周期写权限随后由 report-workflow.ts 统一限制为 admin、quality_manager。
 */
function createSourceScopeValidator(scope: DataScopeType): ReportSourceScopeValidator {
  return async (tx, { source_context, part_revision_ids }) => {
    if (scope !== 'all' && scope !== 'quality') {
      throw new ReportWorkflowError('当前数据范围不允许发布报告', 403)
    }

    const sourceContext = sourceContextSchema.safeParse(source_context)
    if (!sourceContext.success) {
      throw new ReportWorkflowError('发布报告必须包含可追溯的来源检测记录和分析标识', 422)
    }

    const revisionIds = [...new Set(part_revision_ids)]
    if (revisionIds.length === 0) {
      throw new ReportWorkflowError('发布报告必须关联已发布的零件版本', 422)
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

// POST /api/reports/[id]/publish — 审核中报告发布为已发布。
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
    const result = await publishReport(db, {
      reportId: params.data.id,
      actor: access.session.user,
      request,
      validateSourceScope: createSourceScopeValidator(access.scope),
    })

    return NextResponse.json({
      success: true,
      status: '已发布',
      snapshotId: result.snapshotId,
    })
  } catch (error) {
    if (error instanceof ReportWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[POST /api/reports/[id]/publish]', error)
    return NextResponse.json({ error: '发布报告失败' }, { status: 500 })
  }
}
