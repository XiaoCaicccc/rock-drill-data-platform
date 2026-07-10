import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/check-admin'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

// ─── DELETE: 删除用户（不能删自己） ───

export async function DELETE(
  request: NextRequest,
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

  const target = await db.user.findUnique({ where: { id }, select: { email: true, name: true } })
  if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  await db.user.delete({ where: { id } })
  if (currentUserId) await logAudit({ userId: currentUserId, action: 'DELETE', entityType: 'user', entityId: id, before: target, request })
  return NextResponse.json({ success: true })
}
