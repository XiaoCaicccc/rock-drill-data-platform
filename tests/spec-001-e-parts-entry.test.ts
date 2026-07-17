import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { NextRequest } from 'next/server'

type Identity = 'admin' | 'quality_manager' | 'inspector' | 'engineer' | 'viewer' | 'anonymous'

const require = createRequire(import.meta.url)
let identity: Identity = 'anonymous'
let findManyCalls = 0
let lastQuery: Record<string, unknown> | undefined

const inspectionDate = new Date('2020-07-17T11:00:00Z')
const rows = [
  {
    id: 'installed-at-boundary',
    part_revision_id: '00000000-0000-4000-8000-000000000001',
    installed_at: new Date(inspectionDate),
    removed_at: null,
  },
  {
    id: 'removed-at-boundary',
    part_revision_id: '00000000-0000-4000-8000-000000000002',
    installed_at: new Date(inspectionDate.getTime() - 60_000),
    removed_at: new Date(inspectionDate),
  },
  {
    id: 'removed-after-boundary',
    part_revision_id: '00000000-0000-4000-8000-000000000003',
    installed_at: new Date(inspectionDate.getTime() - 60_000),
    removed_at: new Date(inspectionDate.getTime() + 1),
  },
]

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
      findUnique: async () => assert.fail('parts discovery must not perform an owner lookup'),
    },
    equipment_part_installation: {
      findMany: async (query: Record<string, unknown>) => {
        findManyCalls += 1
        lastQuery = query
        return rows
          .filter((row) => row.installed_at <= inspectionDate)
          .filter((row) => row.removed_at === null || row.removed_at > inspectionDate)
          .map((row) => ({
            ...row,
            part_revision: {
              part_id: `part-${row.id}`,
              revision_no: 'A',
              part: {
                code: `CODE-${row.id}`,
                name: `Part ${row.id}`,
                category: { id: 'category-1', code: 'CAT-1', name: 'Category 1' },
              },
            },
          }))
      },
    },
  },
})

const { GET } = require('../src/app/api/inspections/entry/equipment/[id]/parts/route.ts') as {
  GET: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => Promise<Response>
}

function request(timestamp = inspectionDate.toISOString()) {
  return new NextRequest(
    `http://localhost/api/inspections/entry/equipment/equipment-null-owner/parts?inspection_date=${encodeURIComponent(timestamp)}`,
  )
}

function call(timestamp?: string) {
  return GET(request(timestamp), { params: Promise.resolve({ id: 'equipment-null-owner' }) })
}

test('parts discovery enforces the six-identity inspection ledger matrix', async () => {
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
    assert.equal((await call()).status, status, currentIdentity)
  }
})

test('inspector can read a null-creator or non-owned equipment without owner lookup', async () => {
  identity = 'inspector'
  const response = await call()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.parts.map((part: { installation_id: string }) => part.installation_id), [
    'installed-at-boundary',
    'removed-after-boundary',
  ])
})

test('parts discovery rejects invalid timestamps before querying installations', async () => {
  identity = 'inspector'
  for (const timestamp of ['2020-07-17', '2020-07-17T11:00:00', 'invalid', '2999-01-01T00:00:00Z']) {
    const callsBefore = findManyCalls
    const response = await call(timestamp)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'INVALID_REQUEST')
    assert.equal(findManyCalls, callsBefore)
  }
})

test('parts discovery pushes equipment and time boundaries into Prisma with minimal selection', async () => {
  identity = 'inspector'
  const response = await call()
  assert.equal(response.status, 200)
  assert.deepEqual(lastQuery?.where, {
    equipment_id: 'equipment-null-owner',
    installed_at: { lte: inspectionDate },
    OR: [
      { removed_at: null },
      { removed_at: { gt: inspectionDate } },
    ],
  })
  assert.deepEqual(lastQuery?.select, {
    id: true,
    part_revision_id: true,
    installed_at: true,
    removed_at: true,
    part_revision: {
      select: {
        part_id: true,
        revision_no: true,
        part: {
          select: {
            code: true,
            name: true,
            category: { select: { id: true, code: true, name: true } },
          },
        },
      },
    },
  })
})
