import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertManagedLifecycleStatus,
  assertReportTransition,
  getReportWorkflowStatus,
  getStoredReportStatus,
  ReportWorkflowError,
  type ReportLifecycleStatus,
} from '../src/lib/report-workflow'

function assertRejectedTransition(from: ReportLifecycleStatus, to: ReportLifecycleStatus) {
  assert.throws(
    () => assertReportTransition(from, to),
    (error: unknown) => error instanceof ReportWorkflowError && error.status === 409,
  )
}

test('draft report can be submitted for review', () => {
  assert.doesNotThrow(() => assertReportTransition('draft', 'reviewing'))
})

test('reviewing report can be returned to draft', () => {
  assert.doesNotThrow(() => assertReportTransition('reviewing', 'draft'))
})

test('reviewing report can be published', () => {
  assert.doesNotThrow(() => assertReportTransition('reviewing', 'published'))
})

test('draft report cannot be published directly', () => {
  assertRejectedTransition('draft', 'published')
})

test('published report cannot return to draft', () => {
  assertRejectedTransition('published', 'draft')
})

test('published report cannot re-enter reviewing', () => {
  assertRejectedTransition('published', 'reviewing')
})

test('stored lifecycle status mapping remains reversible', () => {
  assert.equal(getReportWorkflowStatus(getStoredReportStatus('draft')), 'draft')
  assert.equal(getReportWorkflowStatus(getStoredReportStatus('reviewing')), 'reviewing')
  assert.equal(getReportWorkflowStatus(getStoredReportStatus('published')), 'published')
})

test('legacy archived reports are excluded from the managed lifecycle', () => {
  assert.equal(getReportWorkflowStatus('\u5df2\u5f52\u6863'), 'legacy_archived')
  assert.throws(
    () => assertManagedLifecycleStatus('\u5df2\u5f52\u6863'),
    (error: unknown) => error instanceof ReportWorkflowError && error.status === 409,
  )
})

test('unknown stored statuses are rejected from the managed lifecycle', () => {
  assert.equal(getReportWorkflowStatus('unexpected'), 'unknown')
  assert.throws(
    () => assertManagedLifecycleStatus('unexpected'),
    (error: unknown) => error instanceof ReportWorkflowError && error.status === 409,
  )
})
