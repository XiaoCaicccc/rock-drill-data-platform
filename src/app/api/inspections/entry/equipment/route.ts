import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  InspectionDomainError,
  toBatchInspectionErrorBody,
  type BatchInspectionErrorCode,
} from '@/lib/inspection-errors'
import { parseInspectionTimestamp } from '@/lib/inspection-integrity'

function errorResponse(status: number, code: BatchInspectionErrorCode, error: string) {
  return NextResponse.json({ error, code }, { status })
}

function authorizationError(response: Response) {
  if (response.status === 401) return errorResponse(401, 'UNAUTHENTICATED', '未登录')
  if (response.status === 403) return errorResponse(403, 'FORBIDDEN', '权限不足')
  return errorResponse(500, 'INTERNAL_ERROR', '服务端授权检查失败')
}

export async function GET(request: NextRequest) {
  const access = await requireDataScopeResource('inspection_ledger')
  if (access instanceof Response) return authorizationError(access)

  let inspectionDate: Date
  try {
    inspectionDate = parseInspectionTimestamp(
      request.nextUrl.searchParams.get('inspection_date'),
      { now: new Date() },
    ).date
  } catch (error) {
    if (error instanceof InspectionDomainError) {
      return NextResponse.json(toBatchInspectionErrorBody(error), { status: error.status })
    }
    return errorResponse(400, 'INVALID_REQUEST', '检测时间无效')
  }

  const scopeWhere = access.scope === 'all' || access.scope === 'quality'
    ? {}
    : { id: { equals: '__forbidden__' } }

  try {
    const equipment = await db.equipment.findMany({
      where: {
        ...scopeWhere,
        installations: {
          some: {
            installed_at: { lte: inspectionDate },
            OR: [
              { removed_at: null },
              { removed_at: { gt: inspectionDate } },
            ],
          },
        },
      },
      select: {
        id: true,
        machine_no: true,
        model: true,
        status: true,
      },
      orderBy: { machine_no: 'asc' },
    })

    return NextResponse.json({ equipment })
  } catch (error) {
    console.error('[GET /api/inspections/entry/equipment]', error)
    return errorResponse(500, 'INTERNAL_ERROR', '获取检测设备列表失败')
  }
}
