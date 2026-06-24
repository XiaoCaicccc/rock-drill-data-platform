import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── GET: 检测记录列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const role = (session.user as { role?: string }).role

  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || ''
  const status = searchParams.get('status') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20))

  const where: any = {}
  if (keyword) {
    where.OR = [
      { record_no: { contains: keyword, mode: 'insensitive' } },
      { inspector: { contains: keyword, mode: 'insensitive' } },
      { batch_no: { contains: keyword, mode: 'insensitive' } },
    ]
  }
  if (status) {
    where.overall_result = status
  }
  // 普通用户只能看自己的数据
  if (role !== 'admin' && userId) {
    where.user_id = userId
  }

  const [total, records] = await Promise.all([
    db.inspection_record.count({ where }),
    db.inspection_record.findMany({
      where,
      include: {
        equipment: { select: { id: true, machine_no: true, model: true } },
        _count: { select: { data_items: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ records, total, page, pageSize })
}
