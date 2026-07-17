import assert from 'node:assert/strict'
import test from 'node:test'
import { openSpec001EPostgresFixture } from './helpers/spec-001-e-postgres'

const scenarios = [
  {
    name: 'concurrent installation removal waits and forces batch revalidation',
    expected: { committedRecords: 0, committedItems: 0, successAudits: 0 },
  },
  {
    name: 'concurrent installation replacement cannot cross the parent equipment lock',
    expected: { committedRecords: 1, committedItems: 1, successAudits: 1 },
  },
  {
    name: 'a rejected multi-item batch rolls back record, items, and success audit',
    expected: { committedRecords: 0, committedItems: 0, successAudits: 0 },
  },
  {
    name: 'concurrent record_no allocation never produces duplicate successful records',
    expected: { committedRecords: 2, committedItems: 2, successAudits: 2 },
  },
] as const

for (const scenario of scenarios) {
  test(scenario.name, async (context) => {
    if (!process.env.DATABASE_URL) {
      context.skip('DATABASE_URL is required; CI supplies PostgreSQL 16')
      return
    }

    const fixture = await openSpec001EPostgresFixture()
    try {
      const postgresScenarioModule = await import('./helpers/spec-001-e-postgres-scenarios')
      const result = await postgresScenarioModule.runSpec001EPostgresScenario(fixture, scenario.name)
      assert.deepEqual(
        {
          committedRecords: result.committedRecords,
          committedItems: result.committedItems,
          successAudits: result.successAudits,
          integrityPreserved: result.integrityPreserved,
        },
        { ...scenario.expected, integrityPreserved: true },
      )
    } finally {
      await fixture.close()
    }
  })
}
