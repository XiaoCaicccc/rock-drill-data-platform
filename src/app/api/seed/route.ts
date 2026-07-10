import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedDatabase } from '../../../../scripts/seed'
import { requireRole } from '@/lib/permissions'

export async function POST(request: Request) {
  const seedToken = request.headers.get('x-seed-token')
  const productionAllowed = Boolean(process.env.SEED_TOKEN && seedToken === process.env.SEED_TOKEN)
  // 正式环境默认禁用。仅在显式配置一次性 SEED_TOKEN 时允许管理员运维使用。
  if (process.env.NODE_ENV === 'production' && !productionAllowed) {
    return NextResponse.json({ error: '未找到接口' }, { status: 404 })
  }
  const access = await requireRole(['admin'])
  if (access instanceof Response) return access

  try {
    const counts = await seedDatabase(db)
    return NextResponse.json({
      success: true,
      message: '种子数据创建完成',
      counts,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '种子数据创建失败'
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    )
  }
}
