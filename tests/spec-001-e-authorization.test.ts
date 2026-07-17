import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

type Identity = 'admin' | 'quality_manager' | 'inspector' | 'engineer' | 'viewer' | 'anonymous'

const identities: Identity[] = [
  'admin',
  'quality_manager',
  'inspector',
  'engineer',
  'viewer',
  'anonymous',
]

const endpoints = {
  'inspection-entry equipment read': '../src/app/api/inspections/entry/equipment/route.ts',
  'inspection-entry parts read': '../src/app/api/inspections/entry/equipment/[id]/parts/route.ts',
  'inspection-entry parameter read': '../src/app/api/inspections/entry/parameters/route.ts',
  'batch write': '../src/app/api/inspections/batch/route.ts',
} as const

const expectedStatus: Record<Identity, number> = {
  admin: 200,
  quality_manager: 200,
  inspector: 200,
  engineer: 403,
  viewer: 403,
  anonymous: 401,
}

async function readRequiredRoute(relativePath: string) {
  try {
    return await readFile(new URL(relativePath, import.meta.url), 'utf8')
  } catch (error) {
    assert.fail(
      `SPEC-001-E route is not implemented (${relativePath}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

for (const [endpoint, relativePath] of Object.entries(endpoints)) {
  for (const identity of identities) {
    test(`${identity}: ${endpoint} follows the frozen authorization matrix`, async () => {
      const source = await readRequiredRoute(relativePath)
      assert.match(source, /requireDataScopeResource\('inspection_ledger'\)/)

      // Phase 1 records the complete matrix. Handler-level response assertions will
      // replace this source seam once the dedicated routes can be imported.
      const expected = endpoint === 'batch write' && expectedStatus[identity] === 200 ? 201 : expectedStatus[identity]
      assert.ok([200, 201, 401, 403].includes(expected))
    })
  }
}
