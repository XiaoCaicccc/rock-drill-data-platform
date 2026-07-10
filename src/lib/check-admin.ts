import { requireRole } from '@/lib/permissions'

/**
 * 管理员权限校验
 * @returns null 表示通过，返回 Response 表示拒绝（403）
 */
export async function requireAdmin(): Promise<Response | null> {
  const result = await requireRole(['admin'])
  return result instanceof Response ? result : null
}
