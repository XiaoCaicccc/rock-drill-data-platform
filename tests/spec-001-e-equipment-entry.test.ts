import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
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
