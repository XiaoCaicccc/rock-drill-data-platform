import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BATCH_ERROR_MESSAGES,
  getBatchErrorMessage,
  getBatchErrorMessageFromResponse,
} from '../src/components/inspections/batch-error'

const expectedMessages = {
  INVALID_REQUEST: '提交内容格式不正确，请检查后重试。',
  FORBIDDEN_FIELD: '提交内容包含不允许的字段，请刷新页面后重试。',
  EMPTY_BATCH: '请至少填写一项检测数据。',
  BATCH_TOO_LARGE: '单次最多提交 500 项检测数据，请分批提交。',
  UNAUTHENTICATED: '登录状态已失效，请重新登录。',
  FORBIDDEN: '当前账号无权执行检测操作。',
  RESOURCE_NOT_FOUND: '检测对象不存在或当前账号无权限访问。',
  REVISION_NOT_RELEASED: '选择的零件版本尚未发布，无法进行检测。',
  INSTALLATION_NOT_ELIGIBLE: '该零件版本在当前检测时间点未安装，请重新选择装配版本。',
  PARAMETER_CATEGORY_MISMATCH: '当前参数不属于该零件类别，请重新选择参数。',
  DUPLICATE_MEASUREMENT: '同一检测记录中存在重复参数，请检查录入数据。',
  CONCURRENT_MODIFICATION: '数据发生并发变化，请刷新后重新提交。',
  INTERNAL_ERROR: '系统异常，请稍后重试。',
} as const

test('every frozen batch error code maps to a business-facing message', () => {
  assert.deepEqual(BATCH_ERROR_MESSAGES, expectedMessages)
  for (const [code, message] of Object.entries(expectedMessages)) {
    assert.equal(getBatchErrorMessage(code), message)
  }
})

test('unknown batch error code uses the internal-error fallback', () => {
  assert.equal(getBatchErrorMessage('DATABASE_FAILURE'), expectedMessages.INTERNAL_ERROR)
  assert.equal(getBatchErrorMessage(undefined), expectedMessages.INTERNAL_ERROR)
})

test('HTTP 409 uses its domain code instead of a generic failure message', async () => {
  const response = new Response(JSON.stringify({
    code: 'INSTALLATION_NOT_ELIGIBLE',
    error: 'internal detail',
  }), { status: 409, headers: { 'Content-Type': 'application/json' } })

  assert.equal(
    await getBatchErrorMessageFromResponse(response),
    expectedMessages.INSTALLATION_NOT_ELIGIBLE,
  )
})

test('non-JSON error responses are handled safely', async () => {
  const response = new Response('<html>proxy error</html>', { status: 502 })
  assert.equal(
    await getBatchErrorMessageFromResponse(response),
    expectedMessages.INTERNAL_ERROR,
  )
})

test('backend database details and stacks are never exposed as user messages', async () => {
  const sensitive = 'SQLSTATE 23505 at prisma stack /var/app/service.ts:42'
  const response = new Response(JSON.stringify({
    code: 'INTERNAL_ERROR',
    error: sensitive,
    stack: sensitive,
  }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  const message = await getBatchErrorMessageFromResponse(response)

  assert.equal(message, expectedMessages.INTERNAL_ERROR)
  assert.equal(message.includes('SQLSTATE'), false)
  assert.equal(message.includes('prisma'), false)
  assert.equal(message.includes('/var/app'), false)
})
