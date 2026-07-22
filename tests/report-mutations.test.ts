import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteDraftReportInTransaction, updateDraftReportInTransaction } from '../src/lib/report-mutations'
import { ReportWorkflowError } from '../src/lib/report-workflow'

const actor = { id: 'user-1', role: 'quality_manager' as const }
const updatedAt = new Date('2026-07-22T00:00:00.000Z')

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1', report_no: 'BG-1', title: 'Original', type: 'analysis', period: null,
    summary: null, conclusion: null, author: 'Author', status: '草稿', user_id: 'user-1',
    source_context: { inspection_record_ids: ['inspection-1'], analysis_identifiers: ['A-1'] },
    updated_at: updatedAt,
    part_revision_links: [{ part_revision_id: 'revision-1' }],
    ...overrides,
  }
}

function transactionMock(current = report()) {
  const calls: Array<{ model: string; args: unknown }> = []
  const tx = {
    calls,
    analysis_report: {
      findUnique: async () => current,
      updateMany: async (args: unknown) => { calls.push({ model: 'updateMany', args }); return { count: 1 } },
      deleteMany: async (args: unknown) => { calls.push({ model: 'deleteMany', args }); return { count: 1 } },
    },
    inspection_record: { findMany: async () => [{ id: 'inspection-1' }] },
    part_revision: { findMany: async () => [{ id: 'revision-1' }] },
    auditLog: { create: async (args: unknown) => { calls.push({ model: 'audit', args }); return args } },
  }
  return tx
}

function transactionMockWithUpdateCount(count: number) {
  const tx = transactionMock()
  tx.analysis_report.updateMany = async (args: unknown) => {
    tx.calls.push({ model: 'updateMany', args })
    return { count }
  }
  return tx
}

function assertError(error: unknown, status: number, code: string) {
  assert.ok(error instanceof ReportWorkflowError)
  assert.equal(error.status, status)
  assert.equal(error.code, code)
}

test('missing report is reported before mutation validation', async () => {
  const tx = transactionMock(null as never)
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'missing', expectedUpdatedAt: updatedAt, actor, dataScope: 'dashboard_only', data: { source_context: {} },
    }),
    (error) => { assertError(error, 404, 'REPORT_NOT_FOUND'); return true },
  )
})

test('non-draft state wins over stale timestamp', async () => {
  const tx = transactionMock(report({ status: '审核中', updated_at: new Date('2026-07-22T00:01:00.000Z') }))
  await assert.rejects(
    deleteDraftReportInTransaction(tx as never, { reportId: 'report-1', expectedUpdatedAt: updatedAt, actor }),
    (error) => { assertError(error, 409, 'REPORT_STATE_CONFLICT'); return true },
  )
})

test('stale draft edit returns edit conflict before source validation', async () => {
  const tx = transactionMock(report({ updated_at: new Date('2026-07-22T00:01:00.000Z') }))
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'dashboard_only', data: { source_context: {} },
    }),
    (error) => { assertError(error, 409, 'REPORT_EDIT_CONFLICT'); return true },
  )
})

test('valid link-only edit advances updated_at and writes audit', async () => {
  const tx = transactionMock()
  const result = await updateDraftReportInTransaction(tx as never, {
    reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'quality', data: { part_revision_ids: ['revision-1'] },
  })
  assert.ok(result.updated_at.getTime() > updatedAt.getTime())
  assert.equal(tx.calls.filter((call) => call.model === 'updateMany').length, 1)
  assert.equal(tx.calls.filter((call) => call.model === 'audit').length, 1)
  const update = tx.calls.find((call) => call.model === 'updateMany')
  assert.deepEqual((update?.args as { where: unknown }).where, { id: 'report-1', status: '草稿', updated_at: updatedAt })
})

test('invalid source scope and missing records use source invalid code', async () => {
  const tx = transactionMock()
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'dashboard_only',
      data: { source_context: { inspection_record_ids: ['inspection-1'], analysis_identifiers: ['A-1'] } },
    }),
    (error) => { assertError(error, 422, 'REPORT_SOURCE_INVALID'); return true },
  )
})

test('duplicate or unreleased revisions use part revision invalid code', async () => {
  const tx = transactionMock()
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'quality', data: { part_revision_ids: ['revision-1', 'revision-1'] },
    }),
    (error) => { assertError(error, 400, 'REPORT_PART_REVISION_INVALID'); return true },
  )
})

test('delete uses conditional CAS and writes audit after deletion', async () => {
  const tx = transactionMock()
  const result = await deleteDraftReportInTransaction(tx as never, { reportId: 'report-1', expectedUpdatedAt: updatedAt, actor })
  assert.deepEqual(result, { reportId: 'report-1' })
  assert.equal(tx.calls.filter((call) => call.model === 'deleteMany').length, 1)
  assert.equal(tx.calls.filter((call) => call.model === 'audit').length, 1)
  const deletion = tx.calls.find((call) => call.model === 'deleteMany')
  assert.deepEqual((deletion?.args as { where: unknown }).where, { id: 'report-1', status: '草稿', updated_at: updatedAt })
})

test('failed edit CAS creates no success audit', async () => {
  const tx = transactionMockWithUpdateCount(0)
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'quality', data: { title: 'Late edit' },
    }),
    (error) => { assertError(error, 409, 'REPORT_EDIT_CONFLICT'); return true },
  )
  assert.equal(tx.calls.filter((call) => call.model === 'audit').length, 0)
})

test('audit failure rejects the edit transaction after mutation staging', async () => {
  const tx = transactionMock()
  tx.auditLog.create = async () => { throw new Error('audit failure') }
  await assert.rejects(
    updateDraftReportInTransaction(tx as never, {
      reportId: 'report-1', expectedUpdatedAt: updatedAt, actor, dataScope: 'quality', data: { title: 'Atomic edit' },
    }),
    /audit failure/,
  )
  assert.equal(tx.calls.filter((call) => call.model === 'updateMany').length, 1)
})
