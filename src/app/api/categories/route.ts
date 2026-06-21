import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/categories - 获取零部件类别列表
export async function GET() {
  try {
    const categories = await db.partCategory.findMany({
      include: {
        _count: { select: { parts: true } }
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ data: categories })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取类别列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}