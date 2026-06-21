import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedDatabase } from '../../../../scripts/seed'

export async function POST() {
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