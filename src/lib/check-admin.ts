import { auth } from '@/lib/auth'

/**
 * 管理员权限校验
 * @returns null 表示通过，返回 Response 表示拒绝（403）
 */
export async function requireAdmin(): Promise<Response | null> {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || role !== 'admin') {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return null
}