import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { UserRole } from '@prisma/client'
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
