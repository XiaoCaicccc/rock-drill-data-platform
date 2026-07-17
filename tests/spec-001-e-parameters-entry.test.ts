import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { NextRequest } from 'next/server'

type Identity = 'admin' | 'quality_manager' | 'inspector' | 'engineer' | 'viewer' | 'anonymous'

const require = createRequire(import.meta.url)
let identity: Identity = 'anonymous'
let findManyCalls = 0
let lastQuery: Record<string, unknown> | undefined

const itemsByCategory: Record<string, Array<Record<string, unknown>>> = {
  'category-other-creator': [{
    id: 'parameter-1',
    param_code: 'P001',
    param_name: '压力',
    unit: 'MPa',
    data_type: 'number',
    standard_min: 1,
    standard_max: 10,
    optimal_min: 3,
    optimal_max: 8,
    sort_order: 1,
  }],
  'category-null-creator': [{
    id: 'parameter-2',
    param_code: 'P002',
    param_name: '状态',
    unit: null,
    data_type: 'text',
    standard_min: null,
    standard_max: null,
    optimal_min: null,
    optimal_max: null,
    sort_order: 2,
  }],
}

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
    parameter_template: {
      findMany: async (query: Record<string, unknown>) => {
        findManyCalls += 1
        lastQuery = query
        const categoryId = (query.where as { category_id: string }).category_id
        const items = itemsByCategory[categoryId]
        return items ? [{ items }] : []
      },
    },
  },
})

const { GET } = require('../src/app/api/inspections/entry/parameters/route.ts') as {
  GET: (request: NextRequest) => Promise<Response>
}

function call(categoryId = 'category-other-creator') {
  return GET(new NextRequest(
    `http://localhost/api/inspections/entry/parameters?category_id=${encodeURIComponent(categoryId)}`,
  ))
}

test('parameter discovery enforces the six-identity inspection ledger matrix', async () => {
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

test('inspector can discover other-creator and null-creator template parameters', async () => {
  identity = 'inspector'
  const otherCreator = await call('category-other-creator')
  const nullCreator = await call('category-null-creator')
  assert.equal(otherCreator.status, 200)
  assert.equal(nullCreator.status, 200)
  assert.deepEqual((await otherCreator.json()).map((item: { id: string }) => item.id), ['parameter-1'])
  assert.deepEqual((await nullCreator.json()).map((item: { id: string }) => item.id), ['parameter-2'])
})

test('parameter discovery rejects missing, blank, or malformed category before querying', async () => {
  identity = 'inspector'
  for (const url of [
    'http://localhost/api/inspections/entry/parameters',
    'http://localhost/api/inspections/entry/parameters?category_id=',
    'http://localhost/api/inspections/entry/parameters?category_id=%20',
    'http://localhost/api/inspections/entry/parameters?category_id=bad%2Fid',
  ]) {
    const callsBefore = findManyCalls
    const response = await GET(new NextRequest(url))
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'INVALID_REQUEST')
    assert.equal(findManyCalls, callsBefore)
  }
})

test('parameter discovery applies category filtering and minimal item selection in Prisma', async () => {
  identity = 'inspector'
  const response = await call('category-other-creator')
  assert.equal(response.status, 200)
  assert.deepEqual(lastQuery?.where, { category_id: 'category-other-creator' })
  assert.deepEqual(lastQuery?.select, {
    items: {
      select: {
        id: true,
        param_code: true,
        param_name: true,
        unit: true,
        data_type: true,
        standard_min: true,
        standard_max: true,
        optimal_min: true,
        optimal_max: true,
        sort_order: true,
      },
      orderBy: { sort_order: 'asc' },
    },
  })
  assert.deepEqual(await response.json(), itemsByCategory['category-other-creator'])
})

test('missing or out-of-scope category returns an indistinguishable empty array', async () => {
  identity = 'inspector'
  for (const categoryId of ['category-missing', 'category-out-of-scope']) {
    const response = await call(categoryId)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), [])
  }
})
