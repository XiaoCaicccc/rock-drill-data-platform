import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const routeSource = readFileSync(
  new URL('../src/app/api/inspections/batch/route.ts', import.meta.url),
  'utf8',
)

test('batch route exposes validator failures as HTTP responses with stable codes', () => {
  assert.match(routeSource, /validateBatchInspectionRequest\(body, \{ now: authoritativeNow \}\)/)
  assert.match(routeSource, /return errorResponse\(validation\.status, validation\.code, validation\.error\)/)
  assert.match(routeSource, /errorResponse\(400, 'INVALID_REQUEST'/)
  assert.match(routeSource, /NextResponse\.json\(toBatchInspectionErrorBody\(error\), \{ status: error\.status \}\)/)
})

test('batch route does not call the service when contract validation fails', () => {
  const validationBlock = routeSource.match(
    /const validation = validateBatchInspectionRequest[\s\S]*?if \(!validation\.success\)[\s\S]*?\n  \}/,
  )?.[0]
  assert.ok(validationBlock)
  assert.equal(validationBlock.includes('createInspectionBatch'), false)
})
