import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { NextRequest } from 'next/server'

type Identity = 'admin' | 'quality_manager' | 'inspector' | 'engineer' | 'viewer' | 'anonymous'

const require = createRequire(import.meta.url)
let identity: Identity = 'anonymous'
let findManyCalls = 0
let lastQuery: Record<string, unknown> | undefined

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
