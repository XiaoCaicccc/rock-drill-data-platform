import assert from 'node:assert/strict'
import test from 'node:test'
import { openSpec001EPostgresFixture } from './helpers/spec-001-e-postgres'

const scenarios = [
  {
    name: 'missing RFC3339 offset leaves no PostgreSQL residue',
    expected: { committedRecords: 0, committedItems: 0, successAudits: 0 },
  },
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
    name: 'invalid installation at inspection time leaves no PostgreSQL residue',
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

const equipmentMutationScenarios = [
  'PG-EQ-01: Equipment PUT audit failure rolls back mutation and success audit',
  'PG-EQ-02: Equipment DELETE audit failure rolls back deletion and success audit',
  'PG-EQ-03: Batch and Equipment PUT share the equipment-first lock',
  'PG-EQ-04: Batch and Equipment DELETE share the lock and revalidate history',
  'PG-EQ-05: concurrent equipment machine_no updates allow at most one success',
] as const

for (const scenario of equipmentMutationScenarios) {
  test(scenario, async (context) => {
    if (!process.env.DATABASE_URL) {
      context.skip('DATABASE_URL is required; CI supplies PostgreSQL 16')
      return
    }

    const fixture = await openSpec001EPostgresFixture()
    try {
      const postgresScenarioModule = await import('./helpers/spec-001-e-postgres-scenarios')
      const result = await postgresScenarioModule.runSpec001EPostgresScenario(fixture, scenario)
      assert.equal(result.integrityPreserved, true, JSON.stringify(result.proof))
    } finally {
      await fixture.close()
    }
  })
}

const installationMutationScenarios = [
  'PG-INST-01: POST create audit failure rolls back installation and success audit',
  'PG-INST-02: POST implicit replacement audit failure rolls back old and new rows',
  'PG-INST-03: Batch and POST serialize on the shared equipment-first lock',
  'PG-INST-04: POST replacement commits before Batch eligibility revalidation',
  'PG-INST-05: PUT removal commits before Batch eligibility revalidation',
  'PG-INST-06: PUT audit failure rolls back removal and success audit',
  'PG-INST-07: concurrent POST requests preserve one active revision per part',
  'PG-INST-08: concurrent PUT requests produce one removal audit and first timestamp',
] as const

for (const scenario of installationMutationScenarios) {
  test(scenario, async (context) => {
    if (!process.env.DATABASE_URL) {
      context.skip('DATABASE_URL is required; CI supplies PostgreSQL 16')
      return
    }

    const fixture = await openSpec001EPostgresFixture()
    try {
      const postgresScenarioModule = await import('./helpers/spec-001-e-postgres-scenarios')
      const result = await postgresScenarioModule.runSpec001EPostgresScenario(fixture, scenario)
      assert.equal(result.integrityPreserved, true, JSON.stringify(result.proof))
    } finally {
      await fixture.close()
    }
  })
}
