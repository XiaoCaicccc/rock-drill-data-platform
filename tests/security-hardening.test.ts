import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { UserRole } from '@prisma/client'
import { NextRequest } from 'next/server'
import { resolveAuthoritativeUser } from '../src/lib/authoritative-user'

const activeRoles: UserRole[] = ['admin', 'quality_manager', 'inspector', 'engineer', 'viewer']

test('uses the current database role and organization for every active identity', async () => {
  for (const role of activeRoles) {
    const user = await resolveAuthoritativeUser('session-user', async () => ({
      id: 'session-user', role, organization_id: `org-${role}`, active: true,
    }))
    assert.deepEqual(user, {
      id: 'session-user', role, organization_id: `org-${role}`,
    })
  }
})

test('rejects a disabled user with an existing session', async () => {
  const user = await resolveAuthoritativeUser('disabled-user', async () => ({
    id: 'disabled-user', role: 'admin', organization_id: null, active: false,
  }))
  assert.equal(user, null)
})

test('applies role downgrade and upgrade without trusting stale JWT claims', async () => {
  for (const currentRole of ['viewer', 'admin'] as const) {
    const user = await resolveAuthoritativeUser('session-user', async () => ({
      id: 'session-user', role: currentRole, organization_id: null, active: true,
    }))
    assert.equal(user?.role, currentRole)
  }
})

test('inspection list, detail, export, and analysis keep their frozen resource entries', async () => {
  const [list, detail, exportRoute, analysis, permissions] = await Promise.all([
    readFile(new URL('../src/app/api/inspections/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/inspections/[id]/details/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/export/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/api/analysis/param-comparison/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/permissions.ts', import.meta.url), 'utf8'),
  ])

  assert.match(list, /requireDataScopeResource\('inspection_ledger'\)/)
  assert.match(detail, /requireDataScopeResource\('inspection_ledger'\)/)
  assert.doesNotMatch(detail, /requireOwnershipOrAdmin|requireAuth\(/)
  assert.match(exportRoute, /requireDataScopeResource\('export'\)/)
  assert.match(analysis, /requireDataScopeResource\('param_analysis'\)/)
  assert.match(permissions, /inspection_ledger: \['admin', 'quality_manager', 'inspector'\]/)
  assert.match(permissions, /export: \['admin', 'quality_manager'\]/)
  assert.match(permissions, /param_analysis: \['admin', 'quality_manager', 'inspector'\]/)
})

type CurrentUser = {
  id: string
  role: UserRole
  organization_id: string | null
  active: boolean
}

const require = createRequire(import.meta.url)
let staleSession: { user: { id: string; role: UserRole; organization_id: string | null } } | null = null
let currentUser: CurrentUser | null = null
let lastListWhere: unknown
let lastDetailWhere: unknown
const analysisWheres: unknown[] = []

const dbMock = {
  user: {
    findUnique: async () => currentUser,
  },
  inspection_record: {
    count: async ({ where }: { where: unknown }) => {
      lastListWhere = where
      return 1
    },
    findMany: async ({ where }: { where: unknown }) => {
      lastListWhere = where
      return []
    },
    findFirst: async ({ where }: { where: unknown }) => {
      lastDetailWhere = where
      return { id: 'inspection-1', data_items: [] }
    },
  },
  parameter_item: {
    findUnique: async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      param_name: where.id,
      param_code: where.id,
      unit: 'mm',
    }),
  },
  inspection_data_item: {
    findMany: async ({ where }: { where: unknown }) => {
      analysisWheres.push(where)
      return []
    },
  },
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

replaceModule('../src/lib/auth.ts', { auth: async () => staleSession })
replaceModule('../src/lib/db.ts', { db: dbMock })
replaceModule('../src/lib/audit.ts', { logAudit: async () => undefined })

const { GET: getInspectionList } = require('../src/app/api/inspections/route.ts') as {
  GET: (request: NextRequest) => Promise<Response>
}
const { GET: getInspectionDetail } = require('../src/app/api/inspections/[id]/details/route.ts') as {
  GET: (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>
}
const { GET: getExport } = require('../src/app/api/export/route.ts') as {
  GET: (request: NextRequest) => Promise<Response>
}
const { GET: getAnalysis } = require('../src/app/api/analysis/param-comparison/route.ts') as {
  GET: (request: NextRequest) => Promise<Response>
}

const apiRequests = {
  list: () => getInspectionList(new NextRequest('http://localhost/api/inspections')),
  detail: () => getInspectionDetail(
    new NextRequest('http://localhost/api/inspections/inspection-1/details'),
    { params: Promise.resolve({ id: 'inspection-1' }) },
  ),
  export: () => getExport(new NextRequest('http://localhost/api/export?type=inspections')),
  analysis: () => getAnalysis(new NextRequest(
    'http://localhost/api/analysis/param-comparison?paramA_id=param-a&paramB_id=param-b',
  )),
}

function setIdentity(databaseRole: UserRole, options: { active?: boolean; staleRole?: UserRole } = {}) {
  staleSession = {
    user: {
      id: 'session-user',
      role: options.staleRole ?? databaseRole,
      organization_id: 'stale-session-org',
    },
  }
  currentUser = {
    id: 'session-user',
    role: databaseRole,
    organization_id: 'current-database-org',
    active: options.active ?? true,
  }
}

test('AUTH-001 rejects an old session immediately after its database user is disabled', async () => {
  setIdentity('inspector', { active: false, staleRole: 'inspector' })

  const response = await apiRequests.list()

  assert.equal(response.status, 401)
})

test('AUTH-001 applies database role downgrade and upgrade to the same old session', async () => {
  setIdentity('inspector', { staleRole: 'admin' })
  assert.equal((await apiRequests.export()).status, 403, 'downgraded stale admin must lose export')
  assert.equal((await apiRequests.list()).status, 200, 'downgraded user keeps current inspector access')

  setIdentity('admin', { staleRole: 'viewer' })
  assert.equal((await apiRequests.export()).status, 200, 'upgraded stale viewer gains current admin access')
})

test('AUTH-002 enforces the six-identity matrix at the real inspection API handlers', async () => {
  const expected: Record<UserRole | 'disabled', Record<keyof typeof apiRequests, number>> = {
    admin: { list: 200, detail: 200, export: 200, analysis: 200 },
    quality_manager: { list: 200, detail: 200, export: 200, analysis: 200 },
    inspector: { list: 200, detail: 200, export: 403, analysis: 200 },
    engineer: { list: 403, detail: 403, export: 403, analysis: 403 },
    viewer: { list: 403, detail: 403, export: 403, analysis: 403 },
    disabled: { list: 401, detail: 401, export: 401, analysis: 401 },
  }

  for (const [identity, endpointStatuses] of Object.entries(expected)) {
    setIdentity(identity === 'disabled' ? 'admin' : identity as UserRole, {
      active: identity !== 'disabled',
    })
    for (const [endpoint, status] of Object.entries(endpointStatuses)) {
      const response = await apiRequests[endpoint as keyof typeof apiRequests]()
      assert.equal(response.status, status, `${identity} GET ${endpoint}`)
    }
  }
})

test('AUTH-002 keeps inspector list, detail, and analysis inside the authorized quality scope', async () => {
  setIdentity('inspector')
  lastListWhere = undefined
  lastDetailWhere = undefined
  analysisWheres.length = 0

  assert.equal((await apiRequests.list()).status, 200)
  assert.equal((await apiRequests.detail()).status, 200)
  assert.equal((await apiRequests.analysis()).status, 200)

  assert.deepEqual(lastListWhere, {})
  assert.deepEqual(lastDetailWhere, { id: 'inspection-1' })
  assert.equal(analysisWheres.length, 2)
  assert.deepEqual(analysisWheres, [
    {
      record: {},
      part_revision_id: { not: null },
      param_item_id: 'param-a',
      value_number: { not: null },
    },
    {
      record: {},
      part_revision_id: { not: null },
      param_item_id: 'param-b',
      value_number: { not: null },
    },
  ])
})
