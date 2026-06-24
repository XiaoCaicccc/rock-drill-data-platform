import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/check-admin'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── DELETE: 删除用户（不能删自己） ───

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin()
  if (denied) return denied

  const session = await auth()
  const { id } = await params
  const currentUserId = (session?.user as { id?: string })?.id

  if (id === currentUserId) {
    return NextResponse.json({ error: '不能删除自己' }, { status: 400 })
  }

  await db.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}