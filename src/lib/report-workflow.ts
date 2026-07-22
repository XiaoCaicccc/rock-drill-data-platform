import type { Prisma, PrismaClient, UserRole } from '@prisma/client'
import { logAudit } from '@/lib/audit'

/** SPEC-001-B 第一版的逻辑状态与既有数据库字符串映射。 */
export const REPORT_LIFECYCLE_STATUS = {
  draft: '草稿',
  reviewing: '审核中',
  published: '已发布',
} as const

export type ReportLifecycleStatus = keyof typeof REPORT_LIFECYCLE_STATUS
export type ReportWorkflowStatus = ReportLifecycleStatus | 'legacy_archived' | 'unknown'

export const REPORT_WORKFLOW_WRITE_ROLES: readonly UserRole[] = [
  'admin',
  'quality_manager',
]

const ALLOWED_TRANSITIONS: Record<ReportLifecycleStatus, readonly ReportLifecycleStatus[]> = {
  draft: ['reviewing'],
  reviewing: ['draft', 'published'],
  published: [],
}

export class ReportWorkflowError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 422,
    public readonly code = status === 404
      ? 'REPORT_NOT_FOUND'
      : status === 409
        ? 'REPORT_STATE_CONFLICT'
        : status === 422
          ? 'REPORT_SOURCE_INVALID'
          : status === 403
            ? 'REPORT_FORBIDDEN'
            : 'INVALID_REQUEST',
  ) {
    super(message)
    this.name = 'ReportWorkflowError'
  }
}

export type ReportWorkflowTransaction = Prisma.TransactionClient

export type ReportSourceScopeValidator = (
  tx: ReportWorkflowTransaction,
  report: {
    id: string
    user_id: string | null
    source_context: Prisma.JsonValue | null
    part_revision_ids: string[]
  },
) => Promise<void>

export function getReportWorkflowStatus(status: string): ReportWorkflowStatus {
  const entry = Object.entries(REPORT_LIFECYCLE_STATUS).find(([, storedStatus]) => storedStatus === status)
  if (entry) return entry[0] as ReportLifecycleStatus
  if (status === '已归档') return 'legacy_archived'
  return 'unknown'
}

export function getStoredReportStatus(status: ReportLifecycleStatus): string {
  return REPORT_LIFECYCLE_STATUS[status]
}

export function assertReportWorkflowWritePermission(role: UserRole) {
  if (!REPORT_WORKFLOW_WRITE_ROLES.includes(role)) {
    throw new ReportWorkflowError('无报告生命周期写权限', 403)
  }
}

export function assertReportTransition(
  from: ReportLifecycleStatus,
  to: ReportLifecycleStatus,
) {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new ReportWorkflowError(`不允许从 ${from} 转换为 ${to}`, 409)
  }
}

type ReportWithSources = {
  id: string
  report_no: string
  title: string
  type: string
  period: string | null
  summary: string | null
  conclusion: string | null
  author: string
  status: string
  user_id: string | null
  source_context: Prisma.JsonValue | null
  part_revision_links: Array<{ part_revision_id: string }>
}

async function loadReportForWorkflow(
  tx: ReportWorkflowTransaction,
  reportId: string,
): Promise<ReportWithSources> {
  const report = await tx.analysis_report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      report_no: true,
      title: true,
      type: true,
      period: true,
      summary: true,
      conclusion: true,
      author: true,
      status: true,
      user_id: true,
      source_context: true,
      part_revision_links: { select: { part_revision_id: true } },
    },
  })
  if (!report) throw new ReportWorkflowError('报告不存在', 404)
  return report
}

export function assertManagedLifecycleStatus(status: string): ReportLifecycleStatus {
  const workflowStatus = getReportWorkflowStatus(status)
  if (workflowStatus === 'legacy_archived') {
    throw new ReportWorkflowError('历史已归档报告仅兼容读取，不能进入第一版生命周期流转', 409)
  }
  if (workflowStatus === 'unknown') {
    throw new ReportWorkflowError(`报告状态“${status}”不受第一版生命周期管理`, 409)
  }
  return workflowStatus
}

function toSnapshotJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export type TransitionReportInTransactionInput = {
  reportId: string
  actor: { id: string; role: UserRole }
  targetStatus: Exclude<ReportLifecycleStatus, 'published'>
  reviewReason?: string
  request?: Request
  validateSourceScope?: ReportSourceScopeValidator
}

/**
 * 用于提交评审和退回修改。发布必须调用 publishReportInTransaction，
 * 以保证状态、快照和审计写入在同一事务内完成。
 */
export async function transitionReportInTransaction(
  tx: ReportWorkflowTransaction,
  input: TransitionReportInTransactionInput,
) {
  assertReportWorkflowWritePermission(input.actor.role)

  const report = await loadReportForWorkflow(tx, input.reportId)
  const from = assertManagedLifecycleStatus(report.status)
  assertReportTransition(from, input.targetStatus)

  if (input.targetStatus === 'reviewing') {
    if (!input.validateSourceScope) {
      throw new ReportWorkflowError('提交评审必须校验报告来源的数据范围', 422)
    }
    await input.validateSourceScope(tx, {
      id: report.id,
      user_id: report.user_id,
      source_context: report.source_context,
      part_revision_ids: report.part_revision_links.map((link) => link.part_revision_id),
    })
  }

  const reviewReason = input.targetStatus === 'draft' ? input.reviewReason?.trim() : null
  if (input.targetStatus === 'draft' && !reviewReason) {
    throw new ReportWorkflowError('退回修改必须填写原因', 422)
  }

  const updated = await tx.analysis_report.updateMany({
    where: { id: report.id, status: report.status },
    data: {
      status: getStoredReportStatus(input.targetStatus),
      review_reason: reviewReason,
    },
  })
  if (updated.count !== 1) {
    throw new ReportWorkflowError('报告状态已变化，请刷新后重试', 409)
  }

  await logAudit({
    userId: input.actor.id,
    action: input.targetStatus === 'reviewing' ? 'SUBMIT_REVIEW' : 'RETURN_FOR_REVISION',
    entityType: 'analysis_report',
    entityId: report.id,
    before: { status: report.status },
    after: { status: getStoredReportStatus(input.targetStatus) },
    metadata: reviewReason ? { reviewReason } : undefined,
    request: input.request,
  }, tx)
}

export type PublishReportInTransactionInput = {
  reportId: string
  actor: { id: string; role: UserRole }
  validateSourceScope: ReportSourceScopeValidator
  request?: Request
}

/**
 * 仅在调用方开启的 Prisma transaction 内执行。
 * 调用方必须把此函数放在 db.$transaction(...) 中，任何异常都会回滚快照、状态和审计。
 */
export async function publishReportInTransaction(
  tx: ReportWorkflowTransaction,
  input: PublishReportInTransactionInput,
) {
  assertReportWorkflowWritePermission(input.actor.role)

  const report = await loadReportForWorkflow(tx, input.reportId)
  const from = assertManagedLifecycleStatus(report.status)
  assertReportTransition(from, 'published')
  if (report.source_context === null) {
    throw new ReportWorkflowError('发布报告必须包含来源上下文', 422)
  }

  await input.validateSourceScope(tx, {
    id: report.id,
    user_id: report.user_id,
    source_context: report.source_context,
    part_revision_ids: report.part_revision_links.map((link) => link.part_revision_id),
  })

  const snapshot = await tx.analysis_report_snapshot.create({
    data: {
      report_id: report.id,
      content_snapshot: toSnapshotJson({
        version: 1,
        report: {
          id: report.id,
          report_no: report.report_no,
          title: report.title,
          type: report.type,
          period: report.period,
          summary: report.summary,
          conclusion: report.conclusion,
          author: report.author,
        },
      }),
      source_snapshot: toSnapshotJson({
        version: 1,
        source_context: report.source_context,
        part_revision_ids: report.part_revision_links.map((link) => link.part_revision_id),
      }),
      published_by: input.actor.id,
    },
  })

  const updated = await tx.analysis_report.updateMany({
    where: { id: report.id, status: report.status },
    data: { status: getStoredReportStatus('published'), review_reason: null },
  })
  if (updated.count !== 1) {
    throw new ReportWorkflowError('报告状态已变化，请刷新后重试', 409)
  }

  await logAudit({
    userId: input.actor.id,
    action: 'PUBLISH',
    entityType: 'analysis_report',
    entityId: report.id,
    before: { status: report.status },
    after: { status: getStoredReportStatus('published'), snapshotId: snapshot.id },
    metadata: { snapshotId: snapshot.id },
    request: input.request,
  }, tx)

  return { reportId: report.id, snapshotId: snapshot.id }
}

/** 供 API 层使用的事务包装器；保持发布原子性。 */
export async function publishReport(
  db: PrismaClient,
  input: PublishReportInTransactionInput,
) {
  return db.$transaction((tx) => publishReportInTransaction(tx, input))
}
