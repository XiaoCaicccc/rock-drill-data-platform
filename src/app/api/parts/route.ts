import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/parts - 获取零部件列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId') || ''
    const search = searchParams.get('search') || ''

    const where: Record<string, unknown> = {}
    if (categoryId) where.categoryId = categoryId
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ]
    }

    const parts = await db.part.findMany({
      where,
      include: { category: true },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ data: parts })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取零部件列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}