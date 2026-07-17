import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireDataScopeResource } from '@/lib/permissions'
import {
  InspectionDomainError,
  toBatchInspectionErrorBody,
  type BatchInspectionErrorCode,
} from '@/lib/inspection-errors'
import { parseInspectionTimestamp } from '@/lib/inspection-integrity'

type RouteContext = { params: Promise<{ id: string }> }

function errorResponse(status: number, code: BatchInspectionErrorCode, error: string) {
  return NextResponse.json({ error, code }, { status })
}

function authorizationError(response: Response) {
  if (response.status === 401) return errorResponse(401, 'UNAUTHENTICATED', '未登录')
  if (response.status === 403) return errorResponse(403, 'FORBIDDEN', '权限不足')
  return errorResponse(500, 'INTERNAL_ERROR', '服务端授权检查失败')
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const access = await requireDataScopeResource('inspection_ledger')
  if (access instanceof Response) return authorizationError(access)

  const { id: equipmentId } = await params
  if (!equipmentId.trim()) return errorResponse(400, 'INVALID_REQUEST', '设备 ID 不能为空')

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
    const installations = await db.equipment_part_installation.findMany({
      where: {
        ...scopeWhere,
        equipment_id: equipmentId,
        installed_at: { lte: inspectionDate },
        OR: [
          { removed_at: null },
          { removed_at: { gt: inspectionDate } },
        ],
      },
      select: {
        id: true,
        part_revision_id: true,
        installed_at: true,
        removed_at: true,
        part_revision: {
          select: {
            part_id: true,
            revision_no: true,
            part: {
              select: {
                code: true,
                name: true,
                category: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json({
      parts: installations.map((installation) => ({
        installation_id: installation.id,
        part_revision_id: installation.part_revision_id,
        part_id: installation.part_revision.part_id,
        part_code: installation.part_revision.part.code,
        part_name: installation.part_revision.part.name,
        category_id: installation.part_revision.part.category.id,
        category_code: installation.part_revision.part.category.code,
        category_name: installation.part_revision.part.category.name,
        revision_no: installation.part_revision.revision_no,
        installed_at: installation.installed_at.toISOString(),
        removed_at: installation.removed_at?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error('[GET /api/inspections/entry/equipment/[id]/parts]', error)
    return errorResponse(500, 'INTERNAL_ERROR', '获取检测零件列表失败')
  }
}
