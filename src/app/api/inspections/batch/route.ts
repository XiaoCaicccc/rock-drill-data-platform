import { NextRequest, NextResponse } from 'next/server'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  InspectionDomainError,
  toBatchInspectionErrorBody,
  type BatchInspectionErrorCode,
} from '@/lib/inspection-errors'
import { validateBatchInspectionRequest } from '@/lib/inspection-integrity'
import { createInspectionBatch } from '@/lib/inspection-integrity-service'

function errorResponse(
  status: number,
  code: BatchInspectionErrorCode,
  error: string,
) {
  return NextResponse.json({ error, code }, { status })
}

function authorizationError(response: Response) {
  if (response.status === 401) {
    return errorResponse(401, 'UNAUTHENTICATED', '未登录')
  }
  if (response.status === 403) {
    return errorResponse(403, 'FORBIDDEN', '权限不足')
  }
  return errorResponse(500, 'INTERNAL_ERROR', '服务端授权检查失败')
}

export async function POST(request: NextRequest) {
  const access = await requireDataScopeResource('inspection_ledger')
  if (access instanceof Response) return authorizationError(access)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', '请求体必须是有效 JSON')
  }

  const authoritativeNow = new Date()
  const validation = validateBatchInspectionRequest(body, { now: authoritativeNow })
  if (!validation.success) {
    return errorResponse(validation.status, validation.code, validation.error)
  }

  try {
    const record = await createInspectionBatch(
      validation.data,
      { userId: access.session.user.id, request },
      { now: () => authoritativeNow },
    )
    return NextResponse.json({
      record,
      message: `检测记录 ${record.record_no} 已保存，共 ${record.data_items.length} 条数据`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof InspectionDomainError) {
      return NextResponse.json(toBatchInspectionErrorBody(error), { status: error.status })
    }
    console.error('[POST /api/inspections/batch]', error)
    return errorResponse(500, 'INTERNAL_ERROR', '保存检测数据失败')
  }
}
