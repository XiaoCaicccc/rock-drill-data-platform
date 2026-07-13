import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  ReportWorkflowError,
  transitionReportInTransaction,
} from '@/lib/report-workflow'

const routeParamsSchema = z.object({
  id: z.string().min(1, '缺少报告 ID'),
})

const returnForRevisionSchema = z.object({
  reason: z.string().trim().min(1, '退回修改必须填写原因'),
})

// POST /api/reports/[id]/return-for-revision — 审核中退回至草稿。
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 })
  }

  const input = returnForRevisionSchema.safeParse(body)
  if (!input.success) {
    return NextResponse.json(
      { error: input.error.issues[0]?.message ?? '退回修改必须填写原因' },
      { status: 422 },
    )
  }

  try {
    await db.$transaction((tx) => transitionReportInTransaction(tx, {
      reportId: params.data.id,
      actor: access.session.user,
      targetStatus: 'draft',
      reviewReason: input.data.reason,
      request,
    }))

    return NextResponse.json({ success: true, status: '草稿' })
  } catch (error) {
    if (error instanceof ReportWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[POST /api/reports/[id]/return-for-revision]', error)
    return NextResponse.json({ error: '退回修改失败' }, { status: 500 })
  }
}
