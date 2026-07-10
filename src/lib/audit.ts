import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type AuditParams = {
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT' | string
  entityType: string
  entityId: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  request?: Request
  metadata?: Prisma.InputJsonValue
}

/** 只记录摘要，禁止把密码、token、完整文件内容写入审计日志。 */
export async function logAudit(params: AuditParams) {
  const ip = params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? params.request?.headers.get('x-real-ip')
    ?? null
  const userAgent = params.request?.headers.get('user-agent') ?? null

  return db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: params.before,
      after: params.after,
      metadata: {
        ...(params.metadata && typeof params.metadata === 'object' ? params.metadata : {}),
        ip,
        userAgent,
      } as Prisma.InputJsonValue,
    },
  })
}
