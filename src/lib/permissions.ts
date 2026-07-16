import type { UserRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { resolveAuthoritativeUser } from '@/lib/authoritative-user'

export type AppSession = {
  user: { id: string; role: UserRole; organization_id?: string | null }
}

/** 当前阶段质量范围包含的业务对象；不在这里构造具体 Prisma 查询。 */
export const QUALITY_SCOPE_ENTITIES = [
  'inspection_record',
  'inspection_data_item',
  'analysis_report',
  'equipment',
  'part',
] as const

export type QualityScopeEntity = (typeof QUALITY_SCOPE_ENTITIES)[number]

/** 角色对应的统一数据范围类型，供后续 API 在查询前转换为具体过滤条件。 */
export type DataScopeType =
  | 'all'
  | 'quality'
  | 'published_reports'
  | 'dashboard_only'

/** SPEC-001-A 当前纳入统一权限控制的查询资源。 */
export type DataScopeResource =
  | 'dashboard'
  | 'inspection_ledger'
  | 'param_analysis'
  | 'reports'
  | 'export'

export type DataScopeContext = {
  session: AppSession
  scope: DataScopeType
}

const ROLE_DATA_SCOPE: Record<UserRole, DataScopeType> = {
  admin: 'all',
  quality_manager: 'quality',
  inspector: 'quality',
  engineer: 'published_reports',
  viewer: 'dashboard_only',
}

/**
 * 资源访问权与数据范围是两个维度：例如 inspector 可读取 Quality Scope，
 * 但第一阶段不具备导出权限。不要仅凭 DataScopeType 判断资源是否可访问。
 */
const RESOURCE_ALLOWED_ROLES: Record<DataScopeResource, readonly UserRole[]> = {
  dashboard: ['admin', 'quality_manager', 'inspector', 'viewer'],
  inspection_ledger: ['admin', 'quality_manager', 'inspector'],
  param_analysis: ['admin', 'quality_manager', 'inspector'],
  reports: ['admin', 'quality_manager', 'inspector', 'engineer'],
  export: ['admin', 'quality_manager'],
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
  const sessionUser = session?.user as { id?: string } | undefined
  const user = await resolveAuthoritativeUser(sessionUser?.id, (userId) =>
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, organization_id: true, active: true },
    }),
  )
  if (!user?.id || !user.role) return jsonError('未登录', 401)
  return { user }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AppSession | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result
  if (!allowedRoles.includes(result.user.role)) return jsonError('权限不足', 403)
  return result
}

/** 根据当前角色解析数据范围类型，不读取客户端传入的身份或范围字段。 */
export function getDataScopeType(role: UserRole): DataScopeType {
  return ROLE_DATA_SCOPE[role]
}

/** 判断角色是否可访问当前阶段已定义的查询资源。 */
export function canAccessDataScopeResource(
  role: UserRole,
  resource: DataScopeResource,
): boolean {
  return RESOURCE_ALLOWED_ROLES[resource].includes(role)
}

/** 获取已认证用户及其数据范围类型；后续 API 在构造查询前调用。 */
export async function requireDataScopeContext(): Promise<DataScopeContext | Response> {
  const result = await requireAuth()
  if (result instanceof Response) return result
  return { session: result, scope: getDataScopeType(result.user.role) }
}

/**
 * 校验当前用户能否访问指定查询资源。
 * 本函数只做身份、角色和范围类型判断；具体 Prisma 过滤条件由接入 API 根据资源实现。
 */
export async function requireDataScopeResource(
  resource: DataScopeResource,
): Promise<DataScopeContext | Response> {
  const result = await requireDataScopeContext()
  if (result instanceof Response) return result
  if (!canAccessDataScopeResource(result.session.user.role, resource)) {
    return jsonError('权限不足', 403)
  }
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

/**
 * 既有 created_by/user_id 查询辅助函数，保留现有 API 行为。
 * 新 API 接入 SPEC-001-A 时，应先通过 requireDataScopeResource 解析统一策略，
 * 再按具体资源构造 Prisma 过滤条件。
 */
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
