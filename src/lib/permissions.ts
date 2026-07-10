import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'

export type AppSession = {
  user: { id: string; role: UserRole; organization_id?: string | null }
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 未登录返回 401，否则返回带有已收窄类型的会话。 */
export async function requireAuth(): Promise<AppSession | Response> {
  const session = await auth()
  const user = session?.user as { id?: string; role?: UserRole; organization_id?: string | null } | undefined
  if (!user?.id || !user.role) return jsonError('未登录', 401)
  return { user: { id: user.id, role: user.role, organization_id: user.organization_id } }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AppSession | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result
  if (!allowedRoles.includes(result.user.role)) return jsonError('权限不足', 403)
  return result
}

export async function requireOwnershipOrAdmin(resourceOwnerId: string | null | undefined): Promise<AppSession | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result
  if (result.user.role === 'admin' || result.user.role === 'quality_manager' || resourceOwnerId === result.user.id) return result
  return jsonError('无权操作其他用户创建的资源', 403)
}

/** 未来多租户扩展点：当前模型未全面落地 organization_id 时不强制过滤。 */
export function scopeByOrganization(orgId?: string | null) {
  return orgId ? { organization_id: orgId } : {}
}

/** 对含 created_by/user_id 的模型应用数据范围。管理员和质量经理可见全部。 */
export function applyDataScope<T extends Record<string, unknown>>(
  session: AppSession,
  baseWhere: T,
  ownerField: 'created_by' | 'user_id' = 'created_by',
): T {
  if (session.user.role === 'admin' || session.user.role === 'quality_manager') return baseWhere
  return { ...baseWhere, [ownerField]: session.user.id } as T
}

export function isWriteRole(role: UserRole) {
  return ['admin', 'quality_manager', 'engineer'].includes(role)
}
