import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireDataScopeResource } from '@/lib/permissions'
import type { BatchInspectionErrorCode } from '@/lib/inspection-errors'

const CATEGORY_ID = /^[A-Za-z0-9_-]{1,128}$/

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

  const categoryId = request.nextUrl.searchParams.get('category_id')
  if (!categoryId || categoryId.trim() !== categoryId || !CATEGORY_ID.test(categoryId)) {
    return errorResponse(400, 'INVALID_REQUEST', 'category_id 格式无效')
  }

  const scopeWhere = access.scope === 'all' || access.scope === 'quality'
    ? {}
    : { id: { equals: '__forbidden__' } }

  try {
    const templates = await db.parameter_template.findMany({
      where: {
        ...scopeWhere,
        category_id: categoryId,
      },
      select: {
        items: {
          select: {
            id: true,
            param_code: true,
            param_name: true,
            unit: true,
            data_type: true,
            standard_min: true,
            standard_max: true,
            optimal_min: true,
            optimal_max: true,
            sort_order: true,
          },
          orderBy: { sort_order: 'asc' },
        },
      },
    })

    return NextResponse.json(templates.flatMap((template) => template.items))
  } catch (error) {
    console.error('[GET /api/inspections/entry/parameters]', error)
    return errorResponse(500, 'INTERNAL_ERROR', '获取检测参数列表失败')
  }
}
