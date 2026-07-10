import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireRole } from '@/lib/permissions'

export async function POST() {
  // 生产 schema 变更只能由 CI/CD 的 Prisma migration 完成，绝不通过 HTTP 暴露。
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '未找到接口' }, { status: 404 })
  }
  const access = await requireRole(['admin'])
  if (access instanceof Response) return access

  try {
    const output = execSync('npx prisma db push --accept-data-loss 2>&1', {
      timeout: 60000,
      env: { ...process.env },
    }).toString()
    return NextResponse.json({ success: true, output })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Setup failed'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
