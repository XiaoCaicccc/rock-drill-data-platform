import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/permissions'

/** 管理员与质量经理查看审计记录；审计记录本身不可通过业务接口修改或删除。 */
export async function GET(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager'])
  if (access instanceof Response) return access

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))
  const userId = searchParams.get('userId') || undefined
  const action = searchParams.get('action') || undefined
  const entityType = searchParams.get('entityType') || undefined
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ])

  return NextResponse.json({ logs, total, page, pageSize })
}
