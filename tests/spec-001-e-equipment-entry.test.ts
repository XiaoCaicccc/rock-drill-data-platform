import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test, { beforeEach } from 'node:test'
import { NextRequest } from 'next/server'

type Identity = 'admin' | 'quality_manager' | 'inspector' | 'engineer' | 'viewer' | 'anonymous'

const require = createRequire(import.meta.url)
let identity: Identity = 'anonymous'
let findManyCalls = 0
let lastQuery: Record<string, unknown> | undefined
let equipmentMutationOutcome:
  | { kind: 'success'; equipment?: Record<string, unknown> }
  | { kind: 'domain'; status: 403 | 404 | 409; message: string }
  | { kind: 'unknown' } = { kind: 'success' }
let lastEquipmentMutationInput: Record<string, unknown> | undefined
let lastInstallationMutationInput: Record<string, unknown> | undefined
let installationMutationOutcome:
  | { kind: 'success'; installation?: Record<string, unknown> }
  | { kind: 'domain'; status: 400 | 403 | 404 | 409; message: string }
  | { kind: 'retry-exhausted' }
  | { kind: 'unknown' } = { kind: 'success' }

function replaceModule(modulePath: string, exports: object) {
  const filename = require.resolve(modulePath)
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module
}

replaceModule('../src/lib/permissions.ts', {
  requireAuth: async () => {
    if (identity === 'anonymous') {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return { user: { id: `user-${identity}`, role: identity } }
  },
  requireRole: async (allowedRoles: Identity[]) => {
    if (identity === 'anonymous') {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!allowedRoles.includes(identity)) {
      return new Response(JSON.stringify({ error: '权限不足' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return { user: { id: `user-${identity}`, role: identity } }
  },
  applyDataScope: (_access: unknown, where: unknown) => where,
  requireDataScopeResource: async () => {
    if (identity === 'anonymous') return new Response(null, { status: 401 })
    if (identity === 'engineer' || identity === 'viewer') {
      return new Response(null, { status: 403 })
    }
    return {
      session: { user: { id: `user-${identity}`, role: identity } },
      scope: identity === 'admin' ? 'all' : 'quality',
    }
  },
})

const actualEquipmentMutationService = require('../src/lib/equipment-mutation-service.ts') as {
  EquipmentMutationError: new (status: 403 | 404 | 409, message: string) => Error
}

async function equipmentMutationStub(input: Record<string, unknown>) {
  lastEquipmentMutationInput = input
  if (equipmentMutationOutcome.kind === 'domain') {
    throw new actualEquipmentMutationService.EquipmentMutationError(
      equipmentMutationOutcome.status,
      equipmentMutationOutcome.message,
    )
  }
  if (equipmentMutationOutcome.kind === 'unknown') throw new Error('unexpected failure')
  return equipmentMutationOutcome.equipment ?? {
    id: 'equipment-1',
    machine_no: 'EQ-001',
    model: 'RD-1',
    status: '在用',
  }
}

replaceModule('../src/lib/equipment-mutation-service.ts', {
  ...actualEquipmentMutationService,
  updateEquipment: equipmentMutationStub,
  deleteEquipment: equipmentMutationStub,
})

const actualInstallationMutationService = require('../src/lib/installation-mutation-service.ts') as {
  InstallationMutationError: new (status: 400 | 403 | 404 | 409, message: string) => Error
}
const { SerializableTransactionRetryExhaustedError } = require('../src/lib/serializable-transaction.ts') as {
  SerializableTransactionRetryExhaustedError: new (lastError: unknown) => Error
}

async function installationMutationStub(input: Record<string, unknown>) {
  lastInstallationMutationInput = input
  if (installationMutationOutcome.kind === 'domain') {
    throw new actualInstallationMutationService.InstallationMutationError(
      installationMutationOutcome.status,
      installationMutationOutcome.message,
    )
  }
  if (installationMutationOutcome.kind === 'retry-exhausted') {
    throw new SerializableTransactionRetryExhaustedError(
      Object.assign(new Error('serialization failure'), { code: '40001' }),
    )
  }
  if (installationMutationOutcome.kind === 'unknown') throw new Error('unexpected installation failure')
  return installationMutationOutcome.installation ?? {
    id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null,
  }
}

replaceModule('../src/lib/installation-mutation-service.ts', {
  ...actualInstallationMutationService,
  createInstallation: installationMutationStub,
  removeInstallation: installationMutationStub,
})

replaceModule('../src/lib/db.ts', {
  db: {
    equipment: {
      findMany: async (query: Record<string, unknown>) => {
        findManyCalls += 1
        lastQuery = query
        return [{ id: 'equipment-1', machine_no: 'EQ-001', model: 'RD-1', status: '在用' }]
      },
    },
  },
})

const { GET } = require('../src/app/api/inspections/entry/equipment/route.ts') as {
  GET: (request: NextRequest) => Promise<Response>
}
const equipmentRoute = require('../src/app/api/equipment/route.ts') as {
  PUT: (request: NextRequest) => Promise<Response>
  DELETE: (request: NextRequest) => Promise<Response>
}
const installationRoute = require('../src/app/api/equipment/[id]/installations/route.ts') as {
  POST: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
  PUT: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
}

function request(inspectionDate = '2020-07-17T11:00:00Z') {
  return new NextRequest(
    `http://localhost/api/inspections/entry/equipment?inspection_date=${encodeURIComponent(inspectionDate)}`,
  )
}

test('equipment discovery enforces the six-identity inspection ledger matrix', async () => {
  const expected: Record<Identity, number> = {
    admin: 200,
    quality_manager: 200,
    inspector: 200,
    engineer: 403,
    viewer: 403,
    anonymous: 401,
  }

  for (const [currentIdentity, status] of Object.entries(expected)) {
    identity = currentIdentity as Identity
    assert.equal((await GET(request())).status, status, currentIdentity)
  }
})

test('equipment discovery rejects invalid timestamps before querying the database', async () => {
  identity = 'inspector'
  for (const timestamp of ['2026-07-17', '2026-07-17T11:00:00', '2999-01-01T00:00:00Z']) {
    const callsBefore = findManyCalls
    const response = await GET(request(timestamp))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'INVALID_REQUEST')
    assert.equal(findManyCalls, callsBefore)
  }
})

test('equipment discovery pushes time eligibility and minimal selection into Prisma', async () => {
  identity = 'inspector'
  const response = await GET(request())
  assert.equal(response.status, 200)
  assert.deepEqual(lastQuery?.select, {
    id: true,
    machine_no: true,
    model: true,
    status: true,
  })
  assert.deepEqual(lastQuery?.where, {
    installations: {
      some: {
        installed_at: { lte: new Date('2020-07-17T11:00:00Z') },
        OR: [
          { removed_at: null },
          { removed_at: { gt: new Date('2020-07-17T11:00:00Z') } },
        ],
      },
    },
  })
  assert.deepEqual(await response.json(), {
    equipment: [{ id: 'equipment-1', machine_no: 'EQ-001', model: 'RD-1', status: '在用' }],
  })
})

function putRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/equipment', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(id = 'equipment-1') {
  return new NextRequest(`http://localhost/api/equipment?id=${id}`, { method: 'DELETE' })
}

async function withCountingCurrentDate<T>(fixedDate: Date, callback: () => Promise<T>) {
  const RealDate = globalThis.Date
  let currentDateCalls = 0
  const CountingDate = function (...args: unknown[]) {
    if (!new.target) return RealDate()
    if (args.length === 0) {
      currentDateCalls += 1
      return new RealDate(fixedDate.getTime())
    }
    return Reflect.construct(RealDate, args)
  } as unknown as DateConstructor
  Object.setPrototypeOf(CountingDate, RealDate)
  Object.defineProperty(CountingDate, 'prototype', { value: RealDate.prototype })
  globalThis.Date = CountingDate
  try {
    const result = await callback()
    return { result, currentDateCalls }
  } finally {
    globalThis.Date = RealDate
  }
}

function installationRequest(method: 'POST' | 'PUT', body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/equipment/equipment-1/installations', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const installationContext = { params: Promise.resolve({ id: 'equipment-1' }) }

beforeEach(() => {
  identity = 'anonymous'
  findManyCalls = 0
  lastQuery = undefined
  equipmentMutationOutcome = { kind: 'success' }
  lastEquipmentMutationInput = undefined
  installationMutationOutcome = { kind: 'success' }
  lastInstallationMutationInput = undefined
})

test('installation POST production route preserves permission, time, and response contracts', async () => {
  identity = 'anonymous'
  let response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1' }), installationContext,
  )
  assert.equal(response.status, 401)

  identity = 'inspector'
  response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1' }), installationContext,
  )
  assert.equal(response.status, 403)

  identity = 'engineer'
  response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1', installed_at: '2026-07-17T11:00:00' }),
    installationContext,
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'installed_at 必须是带时区的 RFC3339 时间' })

  installationMutationOutcome = { kind: 'domain', status: 409, message: '新装配时间不能早于原装配时间' }
  response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1', installed_at: '2026-07-17T11:00:00Z' }),
    installationContext,
  )
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: '新装配时间不能早于原装配时间' })

  installationMutationOutcome = { kind: 'success', installation: { id: 'installation-1', status: 'active' } }
  response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1', installed_at: '2026-07-17T19:00:00+08:00' }),
    installationContext,
  )
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { installation: { id: 'installation-1', status: 'active' } })
  assert.equal((lastInstallationMutationInput?.installedAt as Date).toISOString(), '2026-07-17T11:00:00.000Z')
})

test('installation PUT production route preserves idempotent service response and error mapping', async () => {
  identity = 'engineer'
  let response = await installationRoute.PUT(
    installationRequest('PUT', { installation_id: 'installation-1', removed_at: '2026-07-17T11:00:00' }),
    installationContext,
  )
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'removed_at 必须是带时区的 RFC3339 时间' })

  installationMutationOutcome = { kind: 'domain', status: 404, message: '装配记录不存在' }
  response = await installationRoute.PUT(
    installationRequest('PUT', { installation_id: 'installation-1', removed_at: '2026-07-17T11:00:00Z' }),
    installationContext,
  )
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: '装配记录不存在' })

  installationMutationOutcome = {
    kind: 'success',
    installation: {
      id: 'installation-1',
      equipment_id: 'equipment-1',
      part_revision_id: 'revision-1',
      installed_at: '2026-07-17T10:00:00.000Z',
      removed_at: '2026-07-17T11:00:00.000Z',
      status: 'removed',
      created_by: 'user-engineer',
      created_at: '2026-07-17T10:00:01.000Z',
      remark: 'already removed',
    },
  }
  response = await installationRoute.PUT(
    installationRequest('PUT', { installation_id: 'installation-1', removed_at: '2026-07-17T11:00:00Z' }),
    installationContext,
  )
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    installation: {
      id: 'installation-1',
      equipment_id: 'equipment-1',
      part_revision_id: 'revision-1',
      installed_at: '2026-07-17T10:00:00.000Z',
      removed_at: '2026-07-17T11:00:00.000Z',
      status: 'removed',
      created_by: 'user-engineer',
      created_at: '2026-07-17T10:00:01.000Z',
      remark: 'already removed',
    },
  })
})

test('installation POST production route enforces the complete role matrix', async () => {
  for (const [role, status, body] of [
    ['anonymous', 401, { error: '未登录' }],
    ['viewer', 403, { error: '权限不足' }],
    ['inspector', 403, { error: '权限不足' }],
    ['admin', 201, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
    ['quality_manager', 201, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
    ['engineer', 201, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
  ] as const) {
    identity = role
    const response = await installationRoute.POST(
      installationRequest('POST', { part_revision_id: 'revision-1' }), installationContext,
    )
    assert.equal(response.status, status, role)
    assert.deepEqual(await response.json(), body, role)
    if (status === 201) assert.equal((lastInstallationMutationInput?.actor as { role: string }).role, role)
  }
})

test('installation PUT production route enforces the complete role matrix', async () => {
  for (const [role, status, body] of [
    ['anonymous', 401, { error: '未登录' }],
    ['viewer', 403, { error: '权限不足' }],
    ['inspector', 403, { error: '权限不足' }],
    ['admin', 200, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
    ['quality_manager', 200, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
    ['engineer', 200, { installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null } }],
  ] as const) {
    identity = role
    const response = await installationRoute.PUT(
      installationRequest('PUT', { installation_id: 'installation-1' }), installationContext,
    )
    assert.equal(response.status, status, role)
    assert.deepEqual(await response.json(), body, role)
    if (status === 200) assert.equal((lastInstallationMutationInput?.actor as { role: string }).role, role)
  }
})

test('installation routes preserve required fields, domain mappings, and unknown 500 contracts', async () => {
  identity = 'engineer'
  let response = await installationRoute.POST(installationRequest('POST', {}), installationContext)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: '缺少零件版本 ID' })
  response = await installationRoute.PUT(installationRequest('PUT', {}), installationContext)
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: '缺少装配记录 ID' })

  for (const domain of [
    { status: 400 as const, message: '请求无效' },
    { status: 403 as const, message: '无权操作其他用户创建的资源' },
    { status: 404 as const, message: '设备不存在' },
    { status: 404 as const, message: '零件版本不存在' },
    { status: 409 as const, message: '仅已发布版本允许装配' },
    { status: 409 as const, message: '新装配时间不能早于原装配时间' },
  ]) {
    installationMutationOutcome = { kind: 'domain', ...domain }
    response = await installationRoute.POST(
      installationRequest('POST', { part_revision_id: 'revision-1' }), installationContext,
    )
    assert.equal(response.status, domain.status)
    assert.deepEqual(await response.json(), { error: domain.message })
  }

  for (const domain of [
    { status: 400 as const, message: '请求无效' },
    { status: 403 as const, message: '无权操作其他用户创建的资源' },
    { status: 404 as const, message: '设备不存在' },
    { status: 404 as const, message: '装配记录不存在' },
    { status: 409 as const, message: '拆卸时间不能早于装配时间' },
  ]) {
    installationMutationOutcome = { kind: 'domain', ...domain }
    response = await installationRoute.PUT(
      installationRequest('PUT', { installation_id: 'installation-1' }), installationContext,
    )
    assert.equal(response.status, domain.status)
    assert.deepEqual(await response.json(), { error: domain.message })
  }

  for (const outcome of ['unknown', 'retry-exhausted'] as const) {
    installationMutationOutcome = { kind: outcome }
    response = await installationRoute.POST(
      installationRequest('POST', { part_revision_id: 'revision-1' }), installationContext,
    )
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: '新增装配记录失败' })
    response = await installationRoute.PUT(
      installationRequest('PUT', { installation_id: 'installation-1' }), installationContext,
    )
    assert.equal(response.status, 500)
    assert.deepEqual(await response.json(), { error: '更新装配记录失败' })
  }
})

test('installation routes reject strict timestamp regressions and normalize valid offsets', async () => {
  identity = 'engineer'
  const invalid = [
    '2026-02-30T11:00:00Z',
    '2026-07-17T11:00:00',
    '2026-07-17 11:00:00Z',
    '2026-07-17T11:00:00+08',
    '2025-02-29T11:00:00Z',
    '2026-07-17T24:00:00Z',
    '2026-07-17T11:60:00Z',
    '2026-07-17T11:00:60Z',
    '2026-07-17T11:00:00+24:00',
  ]
  for (const timestamp of invalid) {
    let response = await installationRoute.POST(
      installationRequest('POST', { part_revision_id: 'revision-1', installed_at: timestamp }), installationContext,
    )
    assert.equal(response.status, 400, `POST ${timestamp}`)
    assert.deepEqual(await response.json(), { error: 'installed_at 必须是带时区的 RFC3339 时间' })
    response = await installationRoute.PUT(
      installationRequest('PUT', { installation_id: 'installation-1', removed_at: timestamp }), installationContext,
    )
    assert.equal(response.status, 400, `PUT ${timestamp}`)
    assert.deepEqual(await response.json(), { error: 'removed_at 必须是带时区的 RFC3339 时间' })
  }

  installationMutationOutcome = { kind: 'success' }
  let response = await installationRoute.POST(
    installationRequest('POST', { part_revision_id: 'revision-1', installed_at: '2024-02-29T19:00:00.125+08:00' }),
    installationContext,
  )
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), {
    installation: { id: 'installation-1', equipment_id: 'equipment-1', status: 'active', removed_at: null },
  })
  assert.equal((lastInstallationMutationInput?.installedAt as Date).toISOString(), '2024-02-29T11:00:00.125Z')

})

test('installation POST captures an omitted installed_at exactly once per request', async () => {
  identity = 'engineer'
  installationMutationOutcome = { kind: 'success' }
  const fixedDate = new Date('2026-07-19T01:02:03.456Z')
  const routeRequest = installationRequest('POST', { part_revision_id: 'revision-1' })
  const { result: response, currentDateCalls } = await withCountingCurrentDate(
    fixedDate,
    () => installationRoute.POST(routeRequest, installationContext),
  )
  assert.equal(response.status, 201)
  assert.equal((lastInstallationMutationInput?.installedAt as Date).getTime(), fixedDate.getTime())
  assert.equal(currentDateCalls, 1)
})

test('installation PUT captures an omitted removed_at exactly once per request', async () => {
  identity = 'engineer'
  installationMutationOutcome = { kind: 'success' }
  const fixedDate = new Date('2026-07-19T02:03:04.567Z')
  const routeRequest = installationRequest('PUT', { installation_id: 'installation-1' })
  const { result: response, currentDateCalls } = await withCountingCurrentDate(
    fixedDate,
    () => installationRoute.PUT(routeRequest, installationContext),
  )
  assert.equal(response.status, 200)
  assert.equal((lastInstallationMutationInput?.removedAt as Date).getTime(), fixedDate.getTime())
  assert.equal(currentDateCalls, 1)
})

test('equipment PUT production route preserves authentication, errors, and success contract', async () => {
  identity = 'anonymous'
  let response = await equipmentRoute.PUT(putRequest({ id: 'equipment-1', status: '停用' }))
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '未登录' })

  identity = 'viewer'
  response = await equipmentRoute.PUT(putRequest({ id: 'equipment-1', status: '停用' }))
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: '权限不足' })

  identity = 'engineer'
  for (const domain of [
    { status: 404 as const, message: '设备不存在' },
    { status: 403 as const, message: '无权操作其他用户创建的资源' },
    { status: 409 as const, message: '机头编号 "EQ-002" 已被其他设备使用' },
  ]) {
    equipmentMutationOutcome = { kind: 'domain', ...domain }
    response = await equipmentRoute.PUT(putRequest({ id: 'equipment-1', machine_no: 'EQ-002' }))
    assert.equal(response.status, domain.status)
    assert.deepEqual(await response.json(), { error: domain.message })
  }

  equipmentMutationOutcome = {
    kind: 'domain',
    status: 409,
    message: '机头编号 " EQ-002 " 已被其他设备使用',
  }
  response = await equipmentRoute.PUT(putRequest({
    id: 'equipment-1',
    machine_no: ' EQ-002 ',
  }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), {
    error: '机头编号 " EQ-002 " 已被其他设备使用',
  })
  assert.equal(lastEquipmentMutationInput?.normalizedMachineNo, 'EQ-002')
  assert.equal(lastEquipmentMutationInput?.conflictDisplayMachineNo, ' EQ-002 ')
  assert.deepEqual(lastEquipmentMutationInput?.data, { machine_no: 'EQ-002' })

  const equipment = { id: 'equipment-1', machine_no: 'EQ-001', status: '停用' }
  equipmentMutationOutcome = { kind: 'success', equipment }
  response = await equipmentRoute.PUT(putRequest({ id: 'equipment-1', status: '停用' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { equipment })

  equipmentMutationOutcome = { kind: 'unknown' }
  response = await equipmentRoute.PUT(putRequest({ id: 'equipment-1', status: '停用' }))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: '更新设备失败' })
})

test('equipment DELETE production route preserves authentication, errors, and success contract', async () => {
  identity = 'anonymous'
  let response = await equipmentRoute.DELETE(deleteRequest())
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: '未登录' })

  identity = 'viewer'
  response = await equipmentRoute.DELETE(deleteRequest())
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: '权限不足' })

  identity = 'engineer'
  for (const domain of [
    { status: 404 as const, message: '设备不存在' },
    { status: 403 as const, message: '无权操作其他用户创建的资源' },
    { status: 409 as const, message: '该设备下尚有 2 条装配历史，请先移除相关装配记录' },
  ]) {
    equipmentMutationOutcome = { kind: 'domain', ...domain }
    response = await equipmentRoute.DELETE(deleteRequest())
    assert.equal(response.status, domain.status)
    assert.deepEqual(await response.json(), { error: domain.message })
  }

  equipmentMutationOutcome = { kind: 'success' }
  response = await equipmentRoute.DELETE(deleteRequest())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true })

  equipmentMutationOutcome = { kind: 'unknown' }
  response = await equipmentRoute.DELETE(deleteRequest())
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: '删除设备失败' })
})
