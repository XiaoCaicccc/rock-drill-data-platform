import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fixedNow,
  loadInspectionIntegrityHarness,
  validBatchRequest,
} from './helpers/spec-001-e-harness'
import {
  InspectionDomainError,
  toBatchInspectionErrorBody,
} from '../src/lib/inspection-errors'

function expectTimestamp(value: string) {
  return loadInspectionIntegrityHarness().parseInspectionTimestamp(value, { now: fixedNow })
}

test('timestamp accepts RFC3339 UTC Z', () => {
  const result = expectTimestamp('2026-07-17T11:00:00Z')
  assert.equal(result.normalized, '2026-07-17T11:00:00.000Z')
})

test('timestamp accepts a positive RFC3339 offset', () => {
  const result = expectTimestamp('2026-07-17T19:00:00+08:00')
  assert.equal(result.normalized, '2026-07-17T11:00:00.000Z')
})

test('timestamp accepts a negative RFC3339 offset', () => {
  const result = expectTimestamp('2026-07-17T03:00:00-08:00')
  assert.equal(result.normalized, '2026-07-17T11:00:00.000Z')
})

test('timestamp normalizes equivalent offsets to the same UTC instant', () => {
  const values = [
    expectTimestamp('2026-07-17T11:00:00Z'),
    expectTimestamp('2026-07-17T19:00:00+08:00'),
    expectTimestamp('2026-07-17T03:00:00-08:00'),
  ]
  assert.equal(new Set(values.map((value) => value.date.getTime())).size, 1)
  assert.equal(new Set(values.map((value) => value.normalized)).size, 1)
})

test('timestamp rejects a date-time without an offset', () => {
  assert.throws(
    () => expectTimestamp('2026-07-17T11:00:00'),
    (error: unknown) => {
      assert.ok(error instanceof InspectionDomainError)
      assert.equal(error.status, 400)
      assert.equal(error.code, 'INVALID_REQUEST')
      return true
    },
  )
})

test('timestamp rejects a future instant', () => {
  assert.throws(
    () => expectTimestamp('2026-07-17T12:00:00.001Z'),
    (error: unknown) => {
      assert.ok(error instanceof InspectionDomainError)
      assert.equal(error.status, 400)
      assert.equal(error.code, 'INVALID_REQUEST')
      return true
    },
  )
})

function validate(value: unknown) {
  return loadInspectionIntegrityHarness().validateBatchInspectionRequest(value, { now: fixedNow })
}

test('batch rejects an unknown field', () => {
  const request = { ...validBatchRequest(), unexpected: true }
  const result = validate(request)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 400)
    assert.equal(result.code, 'FORBIDDEN_FIELD')
    assert.ok(result.error)
  }
})

test('batch rejects a forbidden derived or identity field', () => {
  const request = validBatchRequest()
  const value = { ...request, record: { ...request.record, inspector: 'forged-user' } }
  const result = validate(value)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 400)
    assert.equal(result.code, 'FORBIDDEN_FIELD')
    assert.ok(result.error)
  }
})

test('batch rejects an empty items array', () => {
  const result = validate(validBatchRequest(0))
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 400)
    assert.equal(result.code, 'EMPTY_BATCH')
    assert.ok(result.error)
  }
})

test('batch accepts exactly 500 items', () => {
  assert.equal(validate(validBatchRequest(500)).success, true)
})

test('batch rejects 501 items without truncation', () => {
  const result = validate(validBatchRequest(501))
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 400)
    assert.equal(result.code, 'BATCH_TOO_LARGE')
    assert.ok(result.error)
  }
})

test('batch rejects a non-finite numeric value', () => {
  const request = validBatchRequest()
  request.items[0].value_number = Number.POSITIVE_INFINITY
  const result = validate(request)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 400)
    assert.equal(result.code, 'INVALID_REQUEST')
  }
})

test('batch rejects a duplicate normalized revision and parameter tuple', () => {
  const request = validBatchRequest(2)
  request.items[1] = {
    ...request.items[0],
    part_revision_id: request.items[0].part_revision_id.toUpperCase(),
  }
  const result = validate(request)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.status, 409)
    assert.equal(result.code, 'DUPLICATE_MEASUREMENT')
  }
})

test('domain errors expose the stable HTTP status and response body contract', () => {
  const error = new InspectionDomainError('PARAMETER_CATEGORY_MISMATCH', '参数类别不匹配')
  assert.equal(error.status, 409)
  assert.deepEqual(toBatchInspectionErrorBody(error), {
    error: '参数类别不匹配',
    code: 'PARAMETER_CATEGORY_MISMATCH',
  })
})
