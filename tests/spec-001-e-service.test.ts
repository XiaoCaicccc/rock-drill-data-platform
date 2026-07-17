import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { InspectionDomainError } from '../src/lib/inspection-errors'
import {
  lockEquipmentAndAllInstallations,
  lockEquipmentAndInstallationsForPartRevisions,
} from '../src/lib/inspection-equipment-lock'
import { createInspectionBatch } from '../src/lib/inspection-integrity-service'
import { validBatchRequest } from './helpers/spec-001-e-harness'

type Scenario =
  | 'valid'
  | 'missing-equipment'
  | 'not-released'
  | 'not-installed'
  | 'wrong-equipment'
  | 'removed'
  | 'installed-at-boundary'
  | 'category-mismatch'

function serviceFixture(
  scenario: Scenario,
  inspectionDateValue = '2026-07-17T11:00:00Z',
) {
  const input = validBatchRequest()
  input.record.inspection_date = inspectionDateValue
  const revisionId = input.items[0].part_revision_id
  const inspectionDate = new Date(input.record.inspection_date)
  const rawCalls: unknown[] = []
  const writes = { records: 0, audits: 0 }
  let createdData: Record<string, unknown> | undefined
  let transactionClient: typeof tx | undefined
  let recordMutationClient: typeof tx | undefined
  let auditClient: typeof tx | undefined

  const installation = {
    id: 'installation-1',
    equipment_id: scenario === 'wrong-equipment' ? 'equipment-2' : input.record.equipment_id,
    part_revision_id: revisionId,
    installed_at: scenario === 'installed-at-boundary'
      ? new Date(inspectionDate)
      : new Date(inspectionDate.getTime() - 60_000),
    removed_at: scenario === 'removed' ? new Date(inspectionDate) : null,
  }

  const tx = {
    $queryRaw: async (query: unknown) => {
      rawCalls.push(query)
      if (rawCalls.length === 1) {
        return scenario === 'missing-equipment' ? [] : [{ id: input.record.equipment_id }]
      }
      return scenario === 'not-installed' ? [] : [installation]
    },
    user: {
      findUnique: async () => ({ id: 'user-1', name: '权威检测员', active: true }),
    },
    part_revision: {
      findMany: async () => [{
        id: revisionId,
        part_id: 'part-1',
        lifecycle_state: scenario === 'not-released' ? 'draft' : 'released',
        part: { category_id: 'category-1' },
      }],
    },
    parameter_item: {
      findMany: async () => [{
        id: input.items[0].param_item_id,
        standard_min: 0,
        standard_max: 10,
        optimal_min: 2,
        optimal_max: 8,
        template: {
          category_id: scenario === 'category-mismatch' ? 'category-2' : 'category-1',
        },
      }],
    },
    inspection_record: {
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordMutationClient = tx
        writes.records += 1
        createdData = data
        return { id: 'record-1', ...data, data_items: [] }
      },
    },
    auditLog: {
      create: async () => {
        writes.audits += 1
        return { id: 'audit-1' }
      },
    },
  }

  const transactionOptions: unknown[] = []
  const db = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, options: unknown) => {
      transactionOptions.push(options)
      transactionClient = tx
      return callback(tx)
    },
  }

  return {
    input,
    rawCalls,
    writes,
    get createdData() { return createdData },
    get transactionClient() { return transactionClient },
    get recordMutationClient() { return recordMutationClient },
    get auditClient() { return auditClient },
    transactionOptions,
    runTransaction: db.$transaction,
    dependencies: {
      db: db as never,
      audit: (async (_params: unknown, client: typeof tx) => {
        auditClient = client
        return client.auditLog.create()
      }) as never,
      sleep: async (_milliseconds: number) => undefined,
      random: () => 0,
      now: () => new Date('2026-07-17T12:00:00Z'),
    },
  }
}

test('shared helper locks equipment before deterministic installation rows with parameters', async () => {
  const calls: Prisma.Sql[] = []
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      calls.push(query)
      return calls.length === 1 ? [{ id: 'equipment-1' }] : []
    },
  } as unknown as Prisma.TransactionClient

  await lockEquipmentAndInstallationsForPartRevisions(
    tx,
    'equipment-1',
    ['11111111-1111-4111-8111-111111111111'],
  )

  assert.equal(calls.length, 2)
  assert.match(calls[0].sql, /FROM "equipment"[\s\S]*WHERE id = \?[\s\S]*FOR UPDATE/)
  assert.deepEqual(calls[0].values, ['equipment-1'])
  assert.doesNotMatch(calls[0].sql, /::uuid/)
  assert.match(calls[1].sql, /equipment_id = \?[\s\S]*part_revision_id IN \(\?::uuid\)/)
  assert.match(calls[1].sql, /ORDER BY id[\s\S]*FOR UPDATE/)
  assert.deepEqual(calls[1].values, [
    'equipment-1',
    '11111111-1111-4111-8111-111111111111',
  ])
})

test('all-installations helper locks every row after the equipment without rewriting results', async () => {
  const calls: Prisma.Sql[] = []
  const rows = [{
    id: '11111111-1111-4111-8111-111111111111',
    equipment_id: 'equipment-1',
    part_revision_id: '22222222-2222-4222-8222-222222222222',
    installed_at: new Date('2026-07-17T10:00:00Z'),
    removed_at: null,
  }]
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      calls.push(query)
      return calls.length === 1 ? [{ id: 'equipment-1' }] : rows
    },
  } as unknown as Prisma.TransactionClient

  const result = await lockEquipmentAndAllInstallations(tx, 'equipment-1')

  assert.equal(calls.length, 2)
  assert.match(calls[0].sql, /FROM "equipment"[\s\S]*WHERE id = \?[\s\S]*FOR UPDATE/)
  assert.deepEqual(calls[0].values, ['equipment-1'])
  assert.doesNotMatch(calls[0].sql, /::uuid/)
  assert.match(calls[1].sql, /WHERE equipment_id = \?[\s\S]*ORDER BY id[\s\S]*FOR UPDATE/)
  assert.doesNotMatch(calls[1].sql, /part_revision_id\s+IN/)
  assert.deepEqual(calls[1].values, ['equipment-1'])
  assert.equal(result.found, true)
  if (result.found) assert.equal(result.installations, rows)
})

test('revision helper rejects an empty revision list before executing SQL', async () => {
  let queryCount = 0
  const tx = {
    $queryRaw: async () => {
      queryCount += 1
      return []
    },
  } as unknown as Prisma.TransactionClient

  await assert.rejects(
    lockEquipmentAndInstallationsForPartRevisions(
      tx,
      'equipment-1',
      [] as unknown as readonly [string, ...string[]],
    ),
    (error: unknown) => error instanceof TypeError
      && error.message === 'partRevisionIds must contain at least one id',
  )
  assert.equal(queryCount, 0)
})

test('inspection batch imports the shared lock helper without retaining private lock copies', () => {
  const source = readFileSync(
    new URL('../src/lib/inspection-integrity-service.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /lockEquipmentAndInstallationsForPartRevisions/)
  assert.match(source, /await lockEquipmentAndInstallationsForPartRevisions\(/)
  assert.doesNotMatch(source, /function lockEquipment\(/)
  assert.doesNotMatch(source, /function lockInstallations\(/)
})

test('missing equipment preserves the batch domain error and performs no installation lock', async () => {
  const fixture = serviceFixture('missing-equipment')
  await assert.rejects(
    createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies),
    (error: unknown) => error instanceof InspectionDomainError
      && error.code === 'RESOURCE_NOT_FOUND',
  )
  assert.equal(fixture.rawCalls.length, 1)
  assert.equal(fixture.writes.records, 0)
  assert.equal(fixture.writes.audits, 0)
})

async function expectDomainFailure(scenario: Scenario, code: string) {
  const fixture = serviceFixture(scenario)
  await assert.rejects(
    createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies),
    (error: unknown) => {
      assert.ok(error instanceof InspectionDomainError)
      assert.equal(error.code, code)
      return true
    },
  )
  assert.equal(fixture.writes.records, 0)
  assert.equal(fixture.writes.audits, 0)
  assert.deepEqual(fixture.transactionOptions, [{
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }])
  assert.equal(fixture.rawCalls.length, 2, 'equipment lock must precede installation lock')
}

test('business integrity rejects a revision that is not released', async () => {
  await expectDomainFailure('not-released', 'REVISION_NOT_RELEASED')
})

test('business integrity rejects a revision that is not installed', async () => {
  await expectDomainFailure('not-installed', 'INSTALLATION_NOT_ELIGIBLE')
})

test('business integrity rejects a revision installed on another equipment', async () => {
  await expectDomainFailure('wrong-equipment', 'INSTALLATION_NOT_ELIGIBLE')
})

test('business integrity rejects an installation removed at the inspection instant', async () => {
  await expectDomainFailure('removed', 'INSTALLATION_NOT_ELIGIBLE')
})

test('service accepts an installation installed exactly at the inspection instant', async () => {
  const fixture = serviceFixture('installed-at-boundary')
  await createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies)
  assert.equal(fixture.writes.records, 1)
  assert.equal(fixture.writes.audits, 1)
})

test('business integrity rejects a parameter from another category', async () => {
  await expectDomainFailure('category-mismatch', 'PARAMETER_CATEGORY_MISMATCH')
})

test('service rejects a duplicate tuple before opening a transaction', async () => {
  const fixture = serviceFixture('valid')
  fixture.input.items.push({ ...fixture.input.items[0] })
  await assert.rejects(
    createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies),
    (error: unknown) => error instanceof InspectionDomainError
      && error.code === 'DUPLICATE_MEASUREMENT',
  )
  assert.equal(fixture.transactionOptions.length, 0)
})

for (const [name, timestamp] of [
  ['date-only', '2026-07-17'],
  ['date-time without offset', '2026-07-17T11:00:00'],
  ['future timestamp', '2026-07-17T12:00:00.001Z'],
] as const) {
  test(`service rejects ${name} without trusting caller validation`, async () => {
    const fixture = serviceFixture('valid', timestamp)
    await assert.rejects(
      createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies),
      (error: unknown) => error instanceof InspectionDomainError
        && error.code === 'INVALID_REQUEST',
    )
    assert.equal(fixture.transactionOptions.length, 0)
    assert.equal(fixture.writes.records, 0)
    assert.equal(fixture.writes.audits, 0)
  })
}

test('service treats Z and +08:00 representations as the same UTC instant', async () => {
  const utc = serviceFixture('valid', '2026-07-17T11:00:00Z')
  const offset = serviceFixture('valid', '2026-07-17T19:00:00+08:00')

  await createInspectionBatch(utc.input, { userId: 'user-1' }, utc.dependencies)
  await createInspectionBatch(offset.input, { userId: 'user-1' }, offset.dependencies)

  assert.equal(
    (utc.createdData?.inspection_date as Date).getTime(),
    (offset.createdData?.inspection_date as Date).getTime(),
  )
  assert.equal(utc.writes.records, 1)
  assert.equal(offset.writes.records, 1)
})

test('service derives identity, part, qualification, and audit inside the transaction', async () => {
  const fixture = serviceFixture('valid')
  const record = await createInspectionBatch(
    fixture.input,
    { userId: 'user-1' },
    fixture.dependencies,
  ) as unknown as { inspector: string; user_id: string }

  assert.equal(record.inspector, '权威检测员')
  assert.equal(record.user_id, 'user-1')
  assert.equal(fixture.writes.records, 1)
  assert.equal(fixture.writes.audits, 1)
  assert.equal(fixture.rawCalls.length, 2)
  const [equipmentLock, installationLock] = fixture.rawCalls as Prisma.Sql[]
  assert.match(equipmentLock.sql, /FROM "equipment"[\s\S]*FOR UPDATE/)
  assert.deepEqual(equipmentLock.values, [fixture.input.record.equipment_id])
  assert.match(installationLock.sql, /part_revision_id IN \(\?::uuid\)[\s\S]*ORDER BY id[\s\S]*FOR UPDATE/)
  assert.deepEqual(installationLock.values, [
    fixture.input.record.equipment_id,
    fixture.input.items[0].part_revision_id,
  ])
  assert.equal(fixture.recordMutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)
  const item = (fixture.createdData?.data_items as {
    createMany: { data: Array<Record<string, unknown>> }
  }).createMany.data[0]
  assert.equal(item.part_id, 'part-1')
  assert.equal(item.is_qualified, true)
  assert.equal(item.is_optimal, false)
})

for (const retryCode of ['40001', '40P01', 'P2034'] as const) {
  test(`${retryCode} retries at most three times, backs off without a transaction, and exhausts as conflict`, async () => {
    const fixture = serviceFixture('valid')
    let attempts = 0
    let transactionActive = false
    const delays: number[] = []
    fixture.dependencies.db = {
      $transaction: async () => {
        attempts += 1
        transactionActive = true
        try {
          throw Object.assign(new Error('retryable transaction failure'), { code: retryCode })
        } finally {
          transactionActive = false
        }
      },
    } as never
    fixture.dependencies.sleep = async (milliseconds) => {
      assert.equal(transactionActive, false, 'backoff must not hold an interactive transaction')
      delays.push(milliseconds)
    }

    await assert.rejects(
      createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies),
      (error: unknown) => error instanceof InspectionDomainError
        && error.code === 'CONCURRENT_MODIFICATION',
    )
    assert.equal(attempts, 3)
    assert.deepEqual(delays, [25, 75])
  })
}

for (const retryError of [
  Object.assign(new Error('deadlock'), { code: '40P01' }),
  Object.assign(new Error('Prisma conflict'), { code: 'P2034' }),
  Object.assign(new Error('driver serialization failure'), {
    code: 'P2010',
    meta: { code: '40001' },
  }),
  Object.assign(new Error('record number collision'), {
    code: 'P2002',
    meta: { target: ['record_no'] },
  }),
]) {
  test(`service retries ${retryError.code} and reruns the complete transaction`, async () => {
    const fixture = serviceFixture('valid')
    let attempts = 0
    fixture.dependencies.db = {
      $transaction: async (
        callback: Parameters<typeof fixture.runTransaction>[0],
        options: Parameters<typeof fixture.runTransaction>[1],
      ) => {
        attempts += 1
        if (attempts === 1) throw retryError
        return fixture.runTransaction(callback, options)
      },
    } as never

    await createInspectionBatch(fixture.input, { userId: 'user-1' }, fixture.dependencies)
    assert.equal(attempts, 2)
    assert.equal(fixture.writes.records, 1)
    assert.equal(fixture.writes.audits, 1)
  })
}
