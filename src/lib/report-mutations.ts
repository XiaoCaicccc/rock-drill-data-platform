import type { Prisma, PrismaClient, UserRole } from '@prisma/client'
import { logAudit } from './audit'
import { getStoredReportStatus, REPORT_WORKFLOW_WRITE_ROLES, ReportWorkflowError } from './report-workflow'
import type { DataScopeType } from './permissions'

type ReportMutationTransaction = Prisma.TransactionClient

type ReportActor = { id: string; role: UserRole }

type DraftReport = {
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
  updated_at: Date
  part_revision_links: Array<{ part_revision_id: string }>
}

export type ReportMutationData = {
  title?: string
  type?: string
  period?: string | null
  summary?: string | null
  conclusion?: string | null
  author?: string
  source_context?: unknown
  part_revision_ids?: string[]
}

export type UpdateDraftReportInput = {
  reportId: string
  expectedUpdatedAt: Date
  actor: ReportActor
  dataScope: DataScopeType
  data: ReportMutationData
  request?: Request
}

export type DeleteDraftReportInput = {
  reportId: string
  expectedUpdatedAt: Date
  actor: ReportActor
  request?: Request
}

function assertWriteRole(actor: ReportActor) {
  if (!REPORT_WORKFLOW_WRITE_ROLES.includes(actor.role)) {
    throw new ReportWorkflowError('报告生命周期写权限不足', 403, 'REPORT_FORBIDDEN')
  }
}

function loadReport(tx: ReportMutationTransaction, reportId: string) {
  return tx.analysis_report.findUnique({
    where: { id: reportId },
    include: { part_revision_links: { select: { part_revision_id: true } } },
  }) as Promise<DraftReport | null>
}

function assertDraftAndFresh(report: DraftReport, expectedUpdatedAt: Date) {
  if (report.status !== getStoredReportStatus('draft')) {
    throw new ReportWorkflowError('仅草稿状态允许编辑或删除', 409, 'REPORT_STATE_CONFLICT')
  }
  if (report.updated_at.getTime() !== expectedUpdatedAt.getTime()) {
    throw new ReportWorkflowError('报告版本已过期，请刷新后重试', 409, 'REPORT_EDIT_CONFLICT')
  }
}

function parseSourceContext(value: unknown, scope: DataScopeType): Prisma.InputJsonValue {
  if (scope !== 'all' && scope !== 'quality') {
    throw new ReportWorkflowError('当前数据范围不允许写入报告来源上下文', 422, 'REPORT_SOURCE_INVALID')
  }
  if (!value || typeof value !== 'object') {
    throw new ReportWorkflowError('报告来源上下文格式无效', 422, 'REPORT_SOURCE_INVALID')
  }
  const source = value as { inspection_record_ids?: unknown; analysis_identifiers?: unknown }
  if (!Array.isArray(source.inspection_record_ids) || source.inspection_record_ids.length === 0
    || !source.inspection_record_ids.every((id) => typeof id === 'string' && id.length > 0)
    || !Array.isArray(source.analysis_identifiers) || source.analysis_identifiers.length === 0
    || !source.analysis_identifiers.every((id) => typeof id === 'string' && id.length > 0)) {
    throw new ReportWorkflowError('报告来源上下文必须包含检测记录和分析标识', 422, 'REPORT_SOURCE_INVALID')
  }
  return value as Prisma.InputJsonValue
}

async function validateSourceContext(tx: ReportMutationTransaction, value: unknown, scope: DataScopeType) {
  const parsed = parseSourceContext(value, scope)
  const source = parsed as { inspection_record_ids: string[] }
  const ids = [...new Set(source.inspection_record_ids)]
  const records = await tx.inspection_record.findMany({ where: { id: { in: ids } }, select: { id: true } })
  if (records.length !== ids.length) {
    throw new ReportWorkflowError('报告引用了不存在的检测记录', 422, 'REPORT_SOURCE_INVALID')
  }
  return parsed
}

async function validateRevisions(tx: ReportMutationTransaction, ids: string[]) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    throw new ReportWorkflowError('报告引用的零件版本无效或重复', 400, 'REPORT_PART_REVISION_INVALID')
  }
  const revisions = await tx.part_revision.findMany({
    where: { id: { in: ids }, lifecycle_state: 'released' },
    select: { id: true },
  })
  if (revisions.length !== ids.length) {
    throw new ReportWorkflowError('报告只能引用存在且已发布的零件版本', 400, 'REPORT_PART_REVISION_INVALID')
  }
}

function nextUpdatedAt(current: Date) {
  return new Date(Math.max(Date.now(), current.getTime() + 1))
}

export async function updateDraftReportInTransaction(
  tx: ReportMutationTransaction,
  input: UpdateDraftReportInput,
) {
  assertWriteRole(input.actor)
  const report = await loadReport(tx, input.reportId)
  if (!report) throw new ReportWorkflowError('报告不存在', 404, 'REPORT_NOT_FOUND')
  assertDraftAndFresh(report, input.expectedUpdatedAt)

  const data: Record<string, unknown> = {}
  for (const field of ['title', 'type', 'period', 'summary', 'conclusion', 'author'] as const) {
    if (input.data[field] !== undefined) data[field] = input.data[field]
  }
  if (input.data.source_context !== undefined) {
    data.source_context = await validateSourceContext(tx, input.data.source_context, input.dataScope)
  }
  if (input.data.part_revision_ids !== undefined) {
    await validateRevisions(tx, input.data.part_revision_ids)
    data.part_revision_links = {
      deleteMany: {},
      create: input.data.part_revision_ids.map((part_revision_id) => ({ part_revision_id })),
    }
  }
  data.updated_at = nextUpdatedAt(report.updated_at)

  const updated = await tx.analysis_report.updateMany({
    where: { id: report.id, status: getStoredReportStatus('draft'), updated_at: input.expectedUpdatedAt },
    data,
  })
  if (updated.count !== 1) {
    throw new ReportWorkflowError('报告版本或状态已变化，请刷新后重试', 409, 'REPORT_EDIT_CONFLICT')
  }
  await logAudit({
    userId: input.actor.id,
    action: 'UPDATE',
    entityType: 'analysis_report',
    entityId: report.id,
    before: { status: report.status, title: report.title, updated_at: report.updated_at.toISOString() },
    after: { status: report.status, title: data.title ?? report.title, updated_at: (data.updated_at as Date).toISOString() },
    request: input.request,
  }, tx)
  return { ...report, ...data, updated_at: data.updated_at as Date }
}

export async function updateDraftReport(db: PrismaClient, input: UpdateDraftReportInput) {
  return db.$transaction((tx) => updateDraftReportInTransaction(tx, input))
}

export async function deleteDraftReportInTransaction(
  tx: ReportMutationTransaction,
  input: DeleteDraftReportInput,
) {
  assertWriteRole(input.actor)
  const report = await loadReport(tx, input.reportId)
  if (!report) throw new ReportWorkflowError('报告不存在', 404, 'REPORT_NOT_FOUND')
  assertDraftAndFresh(report, input.expectedUpdatedAt)

  const deleted = await tx.analysis_report.deleteMany({
    where: { id: report.id, status: getStoredReportStatus('draft'), updated_at: input.expectedUpdatedAt },
  })
  if (deleted.count !== 1) {
    throw new ReportWorkflowError('报告状态或版本已变化，请刷新后重试', 409, 'REPORT_EDIT_CONFLICT')
  }
  await logAudit({
    userId: input.actor.id,
    action: 'DELETE',
    entityType: 'analysis_report',
    entityId: report.id,
    before: { status: report.status, title: report.title, updated_at: report.updated_at.toISOString() },
    request: input.request,
  }, tx)
  return { reportId: report.id }
}

export async function deleteDraftReport(db: PrismaClient, input: DeleteDraftReportInput) {
  return db.$transaction((tx) => deleteDraftReportInTransaction(tx, input))
}
