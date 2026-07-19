import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Prisma } from '@prisma/client'
import { InspectionDomainError } from '../src/lib/inspection-errors'
import { parseInspectionTimestamp, parseStrictRfc3339Timestamp } from '../src/lib/inspection-integrity'
import {
  deleteEquipment,
  EquipmentMutationError,
  updateEquipment,
} from '../src/lib/equipment-mutation-service'
import {
  lockEquipmentAndAllInstallations,
  lockEquipmentAndInstallationsForPartRevisions,
} from '../src/lib/inspection-equipment-lock'
import { createInspectionBatch } from '../src/lib/inspection-integrity-service'
import {
  createInstallation,
  InstallationMutationError,
  removeInstallation,
} from '../src/lib/installation-mutation-service'
import {
  isRetryablePostgresTransactionError,
  runSerializableTransactionWithRetry,
  SerializableTransactionRetryExhaustedError,
  type InteractiveTransactionDatabase,
} from '../src/lib/serializable-transaction'
import { validBatchRequest } from './helpers/spec-001-e-harness'
import { runProtectedScenarioLifecycle } from './helpers/spec-001-e-postgres-scenarios'

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

test('PostgreSQL scenario lifecycle cleans up even when seeding fails', async () => {
  const seedError = new Error('seed failed')
  let cleanupCalls = 0
  await assert.rejects(runProtectedScenarioLifecycle({
    seed: async () => { throw seedError },
    execute: async () => 'unreachable',
    cleanup: async () => { cleanupCalls += 1 },
  }), (error) => error === seedError)
  assert.equal(cleanupCalls, 1)
})

test('PostgreSQL scenario lifecycle preserves the primary scenario error', async () => {
  const scenarioError = new Error('scenario failed')
  await assert.rejects(runProtectedScenarioLifecycle({
    seed: async () => 'seed',
    execute: async () => { throw scenarioError },
    cleanup: async () => undefined,
  }), (error) => error === scenarioError)
})

test('PostgreSQL scenario lifecycle reports scenario and cleanup errors together', async () => {
  const scenarioError = new Error('scenario failed')
  const cleanupError = new Error('cleanup failed')
  await assert.rejects(runProtectedScenarioLifecycle({
    seed: async () => 'seed',
    execute: async () => { throw scenarioError },
    cleanup: async () => { throw cleanupError },
  }), (error) => (
    error instanceof AggregateError
    && error.errors[0] === scenarioError
    && error.errors[1] === cleanupError
  ))
})

test('PostgreSQL scenario lifecycle releases barriers and settles writers before cleanup', async () => {
  const events: string[] = []
  await assert.rejects(runProtectedScenarioLifecycle({
    seed: async () => 'seed',
    execute: async () => {
      try {
        throw new Error('assertion failed')
      } finally {
        events.push('release')
        await Promise.allSettled([Promise.resolve().then(() => events.push('settled'))])
      }
    },
    cleanup: async () => { events.push('cleanup') },
  }), /assertion failed/)
  assert.deepEqual(events, ['release', 'settled', 'cleanup'])
})

function installationMutationFixture(options: {
  removed?: boolean
  auditFailure?: boolean
  createdBy?: string | null
  oldInstallations?: Array<Record<string, unknown>>
  createFailure?: boolean
  updateFailure?: boolean
  missingEquipment?: boolean
  revisions?: Array<{ id: string; part_id: string; lifecycle_state: string }>
} = {}) {
  const events: string[] = []
  const oldInstallation = {
    id: 'installation-old',
    equipment_id: 'equipment-1',
    part_revision_id: 'revision-old',
    installed_at: new Date('2026-07-17T10:00:00Z'),
    removed_at: options.removed ? new Date('2026-07-17T11:00:00Z') : null,
    status: options.removed ? 'removed' : 'active',
    created_by: 'user-1',
    created_at: new Date('2026-07-17T10:00:01Z'),
    remark: 'existing installation',
  }
  const oldInstallations = (options.oldInstallations ?? [oldInstallation]) as Array<typeof oldInstallation>
  const auditParams: Array<Record<string, unknown>> = []
  const updateInputs: Array<{ where: { id: string }; data: Record<string, unknown> }> = []
  const createInputs: Array<{ data: Record<string, unknown> }> = []
  const auditClients: Array<typeof tx> = []
  let createInput: { data: Record<string, unknown> } | undefined
  let transactionClient: typeof tx | undefined
  let mutationClient: typeof tx | undefined
  let auditClient: typeof tx | undefined
  const tx = {
    $queryRaw: async () => {
      events.push(events.length === 0 ? 'equipment-lock' : 'installation-lock')
      return events.length === 1
        ? (options.missingEquipment ? [] : [{ id: 'equipment-1' }])
        : oldInstallations
    },
    equipment: {
      findUnique: async () => {
        events.push('equipment-reread')
        return { id: 'equipment-1', created_by: options.createdBy === undefined ? 'user-1' : options.createdBy }
      },
    },
    equipment_part_installation: {
      findMany: async () => {
        events.push('installation-reread')
        return oldInstallations
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        events.push(`update:${where.id}`)
        updateInputs.push({ where, data })
        mutationClient = tx
        if (options.updateFailure) throw new Error('installation update failed')
        const row = oldInstallations.find((candidate) => candidate.id === where.id) ?? oldInstallation
        return { ...row, ...data }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push('create')
        createInput = { data }
        createInputs.push({ data })
        mutationClient = tx
        if (options.createFailure) throw new Error('installation create failed')
        return {
          id: 'installation-new',
          ...data,
          created_at: new Date('2026-07-17T11:00:01Z'),
        }
      },
    },
    part_revision: {
      findMany: async () => {
        events.push('revision-reread')
        return options.revisions ?? [
          { id: 'revision-old', part_id: 'part-1', lifecycle_state: 'released' },
          { id: 'revision-new', part_id: 'part-1', lifecycle_state: 'released' },
        ]
      },
    },
    auditLog: { create: async () => ({ id: 'audit-1' }) },
  }
  const dependencies = {
    db: {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>, _options: unknown) => {
        transactionClient = tx
        return callback(tx)
      },
    } as never,
    audit: (async (params: Record<string, unknown>, client: typeof tx) => {
      events.push(`audit:${params.action}:${params.entityId}`)
      auditParams.push(params)
      auditClient = client
      auditClients.push(client)
      if (options.auditFailure) throw new Error('installation audit failed')
      return client.auditLog.create()
    }) as never,
    sleep: async () => undefined,
    random: () => 0,
  }
  return {
    oldInstallation,
    oldInstallations,
    events,
    auditParams,
    auditClients,
    updateInputs,
    createInputs,
    get createInput() { return createInput },
    dependencies,
    get transactionClient() { return transactionClient },
    get mutationClient() { return mutationClient },
    get auditClient() { return auditClient },
  }
}

test('installation create locks, rereads, replaces, and audits with the same transaction client', async () => {
  const fixture = installationMutationFixture()
  const installation = await createInstallation({
    equipmentId: 'equipment-1',
    partRevisionId: 'revision-new',
    installedAt: new Date('2026-07-17T11:00:00Z'),
    remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)
  assert.equal(installation.id, 'installation-new')
  assert.deepEqual(fixture.events, [
    'equipment-lock', 'installation-lock', 'equipment-reread', 'installation-reread',
    'revision-reread', 'update:installation-old', 'audit:UPDATE:installation-old',
    'create', 'audit:CREATE:installation-new',
  ])
  assert.equal(fixture.mutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)
})

test('installation remove is idempotent for an already removed locked row', async () => {
  const fixture = installationMutationFixture({ removed: true })
  const installation = await removeInstallation({
    equipmentId: 'equipment-1',
    installationId: 'installation-old',
    removedAt: new Date('2026-07-17T12:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)
  assert.equal(installation.removed_at?.toISOString(), '2026-07-17T11:00:00.000Z')
  assert.equal(fixture.events.includes('update:installation-old'), false)
  assert.equal(fixture.events.some((event) => event.startsWith('audit:')), false)
})

test('installation mutation audit failure rejects the transaction', async () => {
  const fixture = installationMutationFixture({ auditFailure: true })
  await assert.rejects(
    createInstallation({
      equipmentId: 'equipment-1', partRevisionId: 'revision-new',
      installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    /installation audit failed/,
  )
  assert.equal(fixture.mutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)

  const createAuditFixture = installationMutationFixture({ oldInstallations: [], auditFailure: true })
  await assert.rejects(createInstallation({
    equipmentId: 'equipment-1', partRevisionId: 'revision-new',
    installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, createAuditFixture.dependencies), /installation audit failed/)

  const removeAuditFixture = installationMutationFixture({ auditFailure: true })
  await assert.rejects(removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T11:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, removeAuditFixture.dependencies), /installation audit failed/)
})

test('installation replacement uses stable ID order, exact mutation fields, and ordered audits', async () => {
  const installedAt = new Date('2026-07-17T11:00:00Z')
  const base = {
    equipment_id: 'equipment-1',
    part_revision_id: 'revision-old',
    installed_at: new Date('2026-07-17T10:00:00Z'),
    removed_at: null,
    status: 'active',
    created_by: 'user-1',
    created_at: new Date('2026-07-17T10:00:01Z'),
    remark: null,
  }
  const fixture = installationMutationFixture({
    oldInstallations: [
      { id: 'installation-z', ...base },
      { id: 'installation-a', ...base },
    ],
  })
  await createInstallation({
    equipmentId: 'equipment-1',
    partRevisionId: 'revision-new',
    installedAt,
    remark: 'replacement',
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)

  assert.deepEqual(fixture.updateInputs, [
    { where: { id: 'installation-a' }, data: { status: 'removed', removed_at: installedAt } },
    { where: { id: 'installation-z' }, data: { status: 'removed', removed_at: installedAt } },
  ])
  assert.deepEqual(
    fixture.events,
    [
      'equipment-lock', 'installation-lock', 'equipment-reread', 'installation-reread',
      'revision-reread',
      'update:installation-a', 'audit:UPDATE:installation-a',
      'update:installation-z', 'audit:UPDATE:installation-z',
      'create', 'audit:CREATE:installation-new',
    ],
  )
  assert.deepEqual(fixture.auditParams, [
    {
      userId: 'user-1',
      action: 'UPDATE',
      entityType: 'equipment_part_installation',
      entityId: 'installation-a',
      before: { status: 'active', removed_at: null },
      after: { status: 'removed', removed_at: installedAt },
      request: undefined,
    },
    {
      userId: 'user-1',
      action: 'UPDATE',
      entityType: 'equipment_part_installation',
      entityId: 'installation-z',
      before: { status: 'active', removed_at: null },
      after: { status: 'removed', removed_at: installedAt },
      request: undefined,
    },
    {
      userId: 'user-1',
      action: 'CREATE',
      entityType: 'equipment_part_installation',
      entityId: 'installation-new',
      after: {
        equipment_id: 'equipment-1',
        part_revision_id: 'revision-new',
        installed_at: installedAt,
        status: 'active',
      },
      request: undefined,
    },
  ])
  assert.deepEqual(fixture.auditClients, [
    fixture.transactionClient,
    fixture.transactionClient,
    fixture.transactionClient,
  ])
  assert.deepEqual(fixture.createInput?.data, {
    equipment_id: 'equipment-1',
    part_revision_id: 'revision-new',
    installed_at: installedAt,
    status: 'active',
    removed_at: null,
    created_by: 'user-1',
    remark: 'replacement',
  })
})

test('installation remove returns the same complete row shape for active and idempotent paths', async () => {
  const removedFixture = installationMutationFixture({ removed: true })
  const noOp = await removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T12:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, removedFixture.dependencies)
  assert.deepEqual(noOp, removedFixture.oldInstallation)

  const activeFixture = installationMutationFixture()
  const removedAt = new Date('2026-07-17T12:00:00Z')
  const updated = await removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old', removedAt,
    actor: { id: 'user-1', role: 'engineer' },
  }, activeFixture.dependencies)
  assert.deepEqual(Object.keys(updated).sort(), Object.keys(noOp).sort())
  assert.deepEqual(activeFixture.updateInputs, [{
    where: { id: 'installation-old' },
    data: { status: 'removed', removed_at: removedAt },
  }])
  assert.deepEqual(activeFixture.auditParams[0], {
    userId: 'user-1',
    action: 'UPDATE',
    entityType: 'equipment_part_installation',
    entityId: 'installation-old',
    before: { status: 'active', removed_at: null },
    after: { status: 'removed', removed_at: removedAt },
    request: undefined,
  })

  const wrongEquipmentFixture = installationMutationFixture({
    oldInstallations: [{
      ...activeFixture.oldInstallation,
      equipment_id: 'equipment-2',
    }],
  })
  await assert.rejects(removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old', removedAt,
    actor: { id: 'user-1', role: 'engineer' },
  }, wrongEquipmentFixture.dependencies), (error: unknown) => error instanceof InstallationMutationError
    && error.status === 404)
})

test('installation ownership permits admin, quality manager, and owner only', async () => {
  for (const actor of [
    { id: 'admin-x', role: 'admin' as const },
    { id: 'quality-x', role: 'quality_manager' as const },
    { id: 'user-1', role: 'engineer' as const },
  ]) {
    const fixture = installationMutationFixture({ createdBy: 'user-1' })
    await createInstallation({
      equipmentId: 'equipment-1', partRevisionId: 'revision-new',
      installedAt: new Date('2026-07-17T11:00:00Z'), remark: null, actor,
    }, fixture.dependencies)
  }
  for (const createdBy of ['other-user', null]) {
    const fixture = installationMutationFixture({ createdBy })
    await assert.rejects(createInstallation({
      equipmentId: 'equipment-1', partRevisionId: 'revision-new',
      installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies), (error: unknown) => error instanceof InstallationMutationError
      && error.status === 403)
  }
})

test('installation transaction rereads missing equipment, revision lifecycle, and part identity', async () => {
  const cases = [
    {
      fixture: installationMutationFixture({ missingEquipment: true }),
      status: 404,
    },
    {
      fixture: installationMutationFixture({ revisions: [] }),
      status: 404,
    },
    {
      fixture: installationMutationFixture({
        revisions: [{ id: 'revision-new', part_id: 'part-1', lifecycle_state: 'draft' }],
      }),
      status: 409,
    },
  ]
  for (const { fixture, status } of cases) {
    await assert.rejects(createInstallation({
      equipmentId: 'equipment-1', partRevisionId: 'revision-new',
      installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies), (error: unknown) => error instanceof InstallationMutationError
      && error.status === status)
  }

  const differentPart = installationMutationFixture({
    revisions: [
      { id: 'revision-old', part_id: 'part-old', lifecycle_state: 'released' },
      { id: 'revision-new', part_id: 'part-new', lifecycle_state: 'released' },
    ],
  })
  await createInstallation({
    equipmentId: 'equipment-1', partRevisionId: 'revision-new',
    installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, differentPart.dependencies)
  assert.equal(differentPart.updateInputs.length, 0)
})

test('installation create and remove propagate mutation failures without success audit', async () => {
  for (const fixture of [
    installationMutationFixture({ updateFailure: true }),
    installationMutationFixture({ oldInstallations: [], createFailure: true }),
  ]) {
    await assert.rejects(createInstallation({
      equipmentId: 'equipment-1', partRevisionId: 'revision-new',
      installedAt: new Date('2026-07-17T11:00:00Z'), remark: null,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies), /installation (update|create) failed/)
  }
  const removeFixture = installationMutationFixture({ updateFailure: true })
  await assert.rejects(removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T11:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, removeFixture.dependencies), /installation update failed/)
  assert.equal(removeFixture.auditParams.length, 0)

  const earlierFixture = installationMutationFixture()
  await assert.rejects(removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T09:59:59Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, earlierFixture.dependencies), (error: unknown) => error instanceof InstallationMutationError
    && error.status === 409)
  assert.equal(earlierFixture.updateInputs.length, 0)
  assert.equal(earlierFixture.auditParams.length, 0)

  const earlierCreateFixture = installationMutationFixture()
  await assert.rejects(createInstallation({
    equipmentId: 'equipment-1', partRevisionId: 'revision-new',
    installedAt: new Date('2026-07-17T09:59:59Z'), remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, earlierCreateFixture.dependencies), (error: unknown) => error instanceof InstallationMutationError
    && error.status === 409)
  assert.equal(earlierCreateFixture.updateInputs.length, 0)
  assert.equal(earlierCreateFixture.createInput, undefined)
})

test('installation retries the complete transaction with a stable timestamp and preserves exhaustion type', async () => {
  const fixture = installationMutationFixture()
  const successfulDatabase = fixture.dependencies.db as unknown as InteractiveTransactionDatabase
  let attempts = 0
  fixture.dependencies.db = {
    $transaction: async (operation, options) => {
      attempts += 1
      if (attempts === 1) {
        await successfulDatabase.$transaction(operation, options)
        throw Object.assign(new Error('retry create'), { code: 'P2034' })
      }
      return successfulDatabase.$transaction(operation, options)
    },
  } as never
  fixture.dependencies.sleep = async () => undefined
  const installedAt = new Date('2026-07-17T11:00:00Z')
  await createInstallation({
    equipmentId: 'equipment-1', partRevisionId: 'revision-new', installedAt, remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)
  assert.equal(attempts, 2)
  assert.deepEqual(fixture.createInputs.map((entry) => entry.data.installed_at), [installedAt, installedAt])

  let exhaustedAttempts = 0
  const conflict = Object.assign(new Error('retry exhausted'), { code: '40001' })
  await assert.rejects(createInstallation({
    equipmentId: 'equipment-1', partRevisionId: 'revision-new', installedAt, remark: null,
    actor: { id: 'user-1', role: 'engineer' },
  }, {
    ...fixture.dependencies,
    db: {
      $transaction: async () => {
        exhaustedAttempts += 1
        throw conflict
      },
    } as never,
  }), (error: unknown) => error instanceof SerializableTransactionRetryExhaustedError
    && error.lastError === conflict)
  assert.equal(exhaustedAttempts, 3)

  const removeFixture = installationMutationFixture()
  const removeDatabase = removeFixture.dependencies.db as unknown as InteractiveTransactionDatabase
  let removeAttempts = 0
  removeFixture.dependencies.db = {
    $transaction: async (operation, options) => {
      removeAttempts += 1
      if (removeAttempts === 1) {
        await removeDatabase.$transaction(operation, options)
        removeFixture.oldInstallation.status = 'removed'
        removeFixture.oldInstallation.removed_at = new Date('2026-07-17T10:30:00Z')
        throw Object.assign(new Error('retry remove'), { code: 'P2034' })
      }
      return removeDatabase.$transaction(operation, options)
    },
  } as never
  removeFixture.dependencies.sleep = async () => undefined
  const removed = await removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T11:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, removeFixture.dependencies)
  assert.equal(removeAttempts, 2)
  assert.equal(removed.removed_at?.toISOString(), '2026-07-17T10:30:00.000Z')
  assert.equal(removeFixture.updateInputs.length, 1)
  assert.equal(removeFixture.auditParams.length, 1)

  let removeExhaustedAttempts = 0
  await assert.rejects(removeInstallation({
    equipmentId: 'equipment-1', installationId: 'installation-old',
    removedAt: new Date('2026-07-17T11:00:00Z'),
    actor: { id: 'user-1', role: 'engineer' },
  }, {
    ...removeFixture.dependencies,
    db: {
      $transaction: async () => {
        removeExhaustedAttempts += 1
        throw conflict
      },
    } as never,
  }), (error: unknown) => error instanceof SerializableTransactionRetryExhaustedError
    && error.lastError === conflict)
  assert.equal(removeExhaustedAttempts, 3)
})

test('strict installation timestamp parser rejects calendar and offset regressions', () => {
  for (const value of [
    '2026-02-30T11:00:00Z', '2026-07-17T11:00:00', '2026-07-17 11:00:00Z',
    '2026-07-17T11:00:00+08', '2025-02-29T11:00:00Z', '2026-07-17T24:00:00Z',
    '2026-07-17T11:60:00Z', '2026-07-17T11:00:60Z', '2026-07-17T11:00:00+24:00',
  ]) assert.throws(() => parseStrictRfc3339Timestamp(value))
  assert.equal(
    parseStrictRfc3339Timestamp('2024-02-29T19:00:00.125+08:00').normalized,
    '2024-02-29T11:00:00.125Z',
  )
  assert.throws(() => parseInspectionTimestamp('2026-07-17T11:00:00.000Z', {
    now: new Date('2026-07-17T10:59:59.999Z'),
  }), (error: unknown) => error instanceof InspectionDomainError
    && error.code === 'INVALID_REQUEST')
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

function equipmentMutationFixture(options: {
  missing?: boolean
  installationCount?: number
  auditFailure?: boolean
  duplicateMachineNo?: boolean
  updateError?: unknown
} = {}) {
  const rawCalls: Prisma.Sql[] = []
  const events: string[] = []
  const uniquenessQueries: unknown[] = []
  let transactionClient: typeof tx | undefined
  let mutationClient: typeof tx | undefined
  let auditClient: typeof tx | undefined
  const current = {
    id: 'equipment-1',
    machine_no: 'EQ-001',
    model: 'M1',
    manufacturer: null,
    production_date: null,
    status: '在用',
    current_location: null,
    total_working_hours: 0,
    remark: null,
    created_at: new Date('2026-07-17T00:00:00Z'),
    updated_at: new Date('2026-07-17T00:00:00Z'),
    created_by: 'user-1',
  }
  const installations = Array.from({ length: options.installationCount ?? 0 }, (_, index) => ({
    id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
    equipment_id: current.id,
    part_revision_id: '22222222-2222-4222-8222-222222222222',
    installed_at: new Date('2026-07-17T00:00:00Z'),
    removed_at: null,
  }))
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      rawCalls.push(query)
      events.push(rawCalls.length === 1 ? 'equipment-lock' : 'installation-lock')
      if (rawCalls.length === 1) return options.missing ? [] : [{ id: current.id }]
      return installations
    },
    equipment: {
      findUnique: async () => {
        events.push('equipment-reread')
        return options.missing ? null : current
      },
      findFirst: async (query: unknown) => {
        events.push('uniqueness-check')
        uniquenessQueries.push(query)
        return options.duplicateMachineNo ? { id: 'equipment-2' } : null
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        mutationClient = tx
        events.push('update')
        if (options.updateError) throw options.updateError
        return { ...current, ...data }
      },
      delete: async () => {
        mutationClient = tx
        events.push('delete')
        return current
      },
    },
    auditLog: {
      create: async () => ({ id: 'audit-1' }),
    },
  }
  const transactionOptions: unknown[] = []
  const db = {
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>, options: unknown) => {
      transactionClient = tx
      transactionOptions.push(options)
      return operation(tx)
    },
  }
  const audit = async (_params: unknown, client: typeof tx) => {
    auditClient = client
    events.push('audit')
    if (options.auditFailure) throw new Error('audit failed')
    return client.auditLog.create()
  }

  return {
    current,
    rawCalls,
    events,
    uniquenessQueries,
    transactionOptions,
    get transactionClient() { return transactionClient },
    get mutationClient() { return mutationClient },
    get auditClient() { return auditClient },
    dependencies: {
      db: db as unknown as InteractiveTransactionDatabase,
      audit: audit as never,
      sleep: async (_milliseconds: number) => undefined,
      random: () => 0,
    },
  }
}

test('production equipment update locks, rereads, mutates, and audits in one transaction', async () => {
  const fixture = equipmentMutationFixture()
  const updated = await updateEquipment({
    equipmentId: fixture.current.id,
    data: { status: '停用' },
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)

  assert.equal(updated.status, '停用')
  assert.deepEqual(fixture.events, [
    'equipment-lock',
    'installation-lock',
    'equipment-reread',
    'update',
    'audit',
  ])
  assert.match(fixture.rawCalls[0].sql, /FROM "equipment"[\s\S]*FOR UPDATE/)
  assert.match(fixture.rawCalls[1].sql, /ORDER BY id[\s\S]*FOR UPDATE/)
  assert.equal(fixture.mutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)
  assert.deepEqual(fixture.transactionOptions, [{
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }])
})

test('equipment update audit failure rejects the production transaction', async () => {
  const fixture = equipmentMutationFixture({ auditFailure: true })
  await assert.rejects(
    updateEquipment({
      equipmentId: fixture.current.id,
      data: { status: '停用' },
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    /audit failed/,
  )
  assert.equal(fixture.mutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)
})

test('equipment update rechecks machine number uniqueness after locks and reread', async () => {
  const fixture = equipmentMutationFixture({ duplicateMachineNo: true })
  await assert.rejects(
    updateEquipment({
      equipmentId: fixture.current.id,
      data: { machine_no: 'EQ-002' },
      normalizedMachineNo: 'EQ-002',
      conflictDisplayMachineNo: 'EQ-002',
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 409
      && error.message === '机头编号 "EQ-002" 已被其他设备使用',
  )
  assert.deepEqual(fixture.events, [
    'equipment-lock',
    'installation-lock',
    'equipment-reread',
    'uniqueness-check',
  ])
  assert.equal(fixture.mutationClient, undefined)
  assert.equal(fixture.auditClient, undefined)
})

test('equipment update preserves the original machine number in conflict messages', async () => {
  const fixture = equipmentMutationFixture({ duplicateMachineNo: true })
  await assert.rejects(
    updateEquipment({
      equipmentId: fixture.current.id,
      data: { machine_no: 'EQ-002' },
      normalizedMachineNo: 'EQ-002',
      conflictDisplayMachineNo: ' EQ-002 ',
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 409
      && error.message === '机头编号 " EQ-002 " 已被其他设备使用',
  )
  assert.deepEqual(fixture.uniquenessQueries, [{
    where: { machine_no: 'EQ-002', id: { not: fixture.current.id } },
    select: { id: true },
  }])
})

test('machine number P2002 maps to the original 409 without retrying', async () => {
  const collision = new Prisma.PrismaClientKnownRequestError('unique conflict', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['machine_no'] },
  })
  const fixture = equipmentMutationFixture({ updateError: collision })
  await assert.rejects(
    updateEquipment({
      equipmentId: fixture.current.id,
      data: { machine_no: 'EQ-002' },
      normalizedMachineNo: 'EQ-002',
      conflictDisplayMachineNo: ' EQ-002 ',
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 409
      && error.message === '机头编号 " EQ-002 " 已被其他设备使用',
  )
  assert.equal(fixture.transactionOptions.length, 1)
})

test('P2002 for another field is not mapped as a machine number conflict', async () => {
  const collision = new Prisma.PrismaClientKnownRequestError('other unique conflict', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['another_field'] },
  })
  const fixture = equipmentMutationFixture({ updateError: collision })
  await assert.rejects(
    updateEquipment({
      equipmentId: fixture.current.id,
      data: { status: '停用' },
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    (error: unknown) => error === collision,
  )
  assert.equal(fixture.transactionOptions.length, 1)
})

test('production equipment delete checks locked installation rows before mutation', async () => {
  const fixture = equipmentMutationFixture({ installationCount: 2 })
  await assert.rejects(
    deleteEquipment({
      equipmentId: fixture.current.id,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 409
      && error.message === '该设备下尚有 2 条装配历史，请先移除相关装配记录',
  )
  assert.deepEqual(fixture.events, [
    'equipment-lock',
    'installation-lock',
    'equipment-reread',
  ])
  assert.equal(fixture.mutationClient, undefined)
  assert.equal(fixture.auditClient, undefined)
})

test('production equipment delete and audit use the same transaction and audit failure rejects', async () => {
  const fixture = equipmentMutationFixture({ auditFailure: true })
  await assert.rejects(
    deleteEquipment({
      equipmentId: fixture.current.id,
      actor: { id: 'user-1', role: 'engineer' },
    }, fixture.dependencies),
    /audit failed/,
  )
  assert.deepEqual(fixture.events, [
    'equipment-lock',
    'installation-lock',
    'equipment-reread',
    'delete',
    'audit',
  ])
  assert.equal(fixture.mutationClient, fixture.transactionClient)
  assert.equal(fixture.auditClient, fixture.transactionClient)
})

test('equipment mutations preserve missing and ownership errors after locking', async () => {
  const missing = equipmentMutationFixture({ missing: true })
  await assert.rejects(
    updateEquipment({
      equipmentId: missing.current.id,
      data: {},
      actor: { id: 'user-1', role: 'engineer' },
    }, missing.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 404 && error.message === '设备不存在',
  )
  assert.equal(missing.rawCalls.length, 1)

  const missingDelete = equipmentMutationFixture({ missing: true })
  await assert.rejects(
    deleteEquipment({
      equipmentId: missingDelete.current.id,
      actor: { id: 'user-1', role: 'engineer' },
    }, missingDelete.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 404 && error.message === '设备不存在',
  )
  assert.equal(missingDelete.rawCalls.length, 1)

  const owned = equipmentMutationFixture()
  await assert.rejects(
    deleteEquipment({
      equipmentId: owned.current.id,
      actor: { id: 'other-user', role: 'engineer' },
    }, owned.dependencies),
    (error: unknown) => error instanceof EquipmentMutationError
      && error.status === 403 && error.message === '无权操作其他用户创建的资源',
  )
})

test('equipment mutation retries the complete transaction with backoff outside it', async () => {
  const fixture = equipmentMutationFixture()
  const successfulTransaction = fixture.dependencies.db.$transaction
  let attempts = 0
  let transactionActive = false
  const delays: number[] = []
  fixture.dependencies.db = {
    $transaction: async (...args: Parameters<typeof successfulTransaction>) => {
      attempts += 1
      transactionActive = true
      try {
        if (attempts === 1) throw Object.assign(new Error('conflict'), { code: 'P2034' })
        return await successfulTransaction(...args)
      } finally {
        transactionActive = false
      }
    },
  } as never
  fixture.dependencies.sleep = async (milliseconds: number) => {
    assert.equal(transactionActive, false)
    delays.push(milliseconds)
  }

  await updateEquipment({
    equipmentId: fixture.current.id,
    data: { status: '停用' },
    actor: { id: 'user-1', role: 'engineer' },
  }, fixture.dependencies)
  assert.equal(attempts, 2)
  assert.deepEqual(delays, [25])
})

async function exerciseSerializableRunner(errorFactory: (attempt: number) => unknown) {
  let attempts = 0
  let transactionActive = false
  const delays: number[] = []
  const isolationLevels: unknown[] = []
  const result = await runSerializableTransactionWithRetry({
    $transaction: async (operation, options) => {
      attempts += 1
      isolationLevels.push(options.isolationLevel)
      transactionActive = true
      try {
        const error = errorFactory(attempts)
        if (error) throw error
        return await operation({} as Prisma.TransactionClient)
      } finally {
        transactionActive = false
      }
    },
  }, async () => 'committed', {
    random: () => 0,
    sleep: async (milliseconds) => {
      assert.equal(transactionActive, false)
      delays.push(milliseconds)
    },
  })
  return { result, attempts, delays, isolationLevels }
}

for (const [name, errorFactory] of [
  ['40001', () => Object.assign(new Error('serialization'), { code: '40001' })],
  ['40P01', () => Object.assign(new Error('deadlock'), { code: '40P01' })],
  ['P2034', () => Object.assign(new Error('prisma conflict'), { code: 'P2034' })],
  ['meta.code 40001', () => Object.assign(new Error('serialization'), { meta: { code: '40001' } })],
  ['nested cause', () => Object.assign(new Error('wrapper'), {
    cause: Object.assign(new Error('serialization'), { code: '40001' }),
  })],
] as const) {
  test(`serializable runner retries ${name} with Serializable isolation`, async () => {
    const result = await exerciseSerializableRunner((attempt) => (
      attempt === 1 ? errorFactory() : undefined
    ))
    assert.equal(result.result, 'committed')
    assert.equal(result.attempts, 2)
    assert.deepEqual(result.delays, [25])
    assert.deepEqual(result.isolationLevels, [
      Prisma.TransactionIsolationLevel.Serializable,
      Prisma.TransactionIsolationLevel.Serializable,
    ])
  })
}

test('serializable runner does not retry non-retryable or machine number P2002 errors', async () => {
  for (const error of [
    new Error('ordinary failure'),
    new Prisma.PrismaClientKnownRequestError('machine conflict', {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['machine_no'] },
    }),
  ]) {
    let attempts = 0
    await assert.rejects(runSerializableTransactionWithRetry({
      $transaction: async () => {
        attempts += 1
        throw error
      },
    }, async () => undefined), (caught: unknown) => caught === error)
    assert.equal(attempts, 1)
  }
})

test('serializable runner caps attempts at three and uses deterministic two-stage backoff', async () => {
  let attempts = 0
  let transactionActive = false
  const delays: number[] = []
  const conflict = Object.assign(new Error('serialization'), { code: '40001' })
  await assert.rejects(runSerializableTransactionWithRetry({
    $transaction: async () => {
      attempts += 1
      transactionActive = true
      try {
        throw conflict
      } finally {
        transactionActive = false
      }
    },
  }, async () => undefined, {
    random: () => 0,
    sleep: async (milliseconds) => {
      assert.equal(transactionActive, false)
      delays.push(milliseconds)
    },
  }), (error: unknown) => error instanceof SerializableTransactionRetryExhaustedError
    && error.lastError === conflict)
  assert.equal(attempts, 3)
  assert.deepEqual(delays, [25, 75])
})

test('serializable runner accepts a custom Batch record number collision predicate', async () => {
  let attempts = 0
  const collision = new Prisma.PrismaClientKnownRequestError('record conflict', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target: ['record_no'] },
  })
  const result = await runSerializableTransactionWithRetry({
    $transaction: async (operation) => {
      attempts += 1
      if (attempts === 1) throw collision
      return operation({} as Prisma.TransactionClient)
    },
  }, async () => 'committed', {
    sleep: async () => undefined,
    isRetryable: (error) => error === collision,
  })
  assert.equal(result, 'committed')
  assert.equal(attempts, 2)
})

test('serializable runner safely rejects a self-referential non-retryable cause', async () => {
  const error: { code: string; cause?: unknown } = { code: 'OTHER' }
  error.cause = error
  let attempts = 0
  await assert.rejects(runSerializableTransactionWithRetry({
    $transaction: async () => {
      attempts += 1
      throw error
    },
  }, async () => undefined), (caught: unknown) => caught === error)
  assert.equal(attempts, 1)
  assert.equal(isRetryablePostgresTransactionError(error), false)
})

test('serializable classifier safely terminates a two-node cause cycle', () => {
  const first: { code: string; cause?: unknown } = { code: 'OTHER' }
  const second: { code: string; cause?: unknown } = { code: 'OTHER' }
  first.cause = second
  second.cause = first
  assert.equal(isRetryablePostgresTransactionError(first), false)
})

test('serializable runner recognizes retryable code inside a cause cycle and still caps attempts', async () => {
  const first: { code: string; cause?: unknown } = { code: 'OTHER' }
  const second: { code: string; cause?: unknown } = { code: 'P2034' }
  first.cause = second
  second.cause = first
  let attempts = 0
  await assert.rejects(runSerializableTransactionWithRetry({
    $transaction: async () => {
      attempts += 1
      throw first
    },
  }, async () => undefined, { sleep: async () => undefined }),
  (error: unknown) => error instanceof SerializableTransactionRetryExhaustedError
    && error.lastError === first)
  assert.equal(attempts, 3)
})

test('Batch retries a record number P2002 inside a cause cycle without misclassifying machine number P2002', async () => {
  const recordNode: {
    code: string
    meta: { target: string[] }
    cause?: unknown
  } = { code: 'P2002', meta: { target: ['record_no'] } }
  const recordWrapper: { code: string; cause?: unknown } = { code: 'OTHER' }
  recordWrapper.cause = recordNode
  recordNode.cause = recordWrapper

  const retryFixture = serviceFixture('valid')
  let retryAttempts = 0
  retryFixture.dependencies.db = {
    $transaction: async (
      callback: Parameters<typeof retryFixture.runTransaction>[0],
      options: Parameters<typeof retryFixture.runTransaction>[1],
    ) => {
      retryAttempts += 1
      if (retryAttempts === 1) throw recordWrapper
      return retryFixture.runTransaction(callback, options)
    },
  } as never
  await createInspectionBatch(retryFixture.input, { userId: 'user-1' }, retryFixture.dependencies)
  assert.equal(retryAttempts, 2)

  const machineNode: {
    code: string
    meta: { target: string[] }
    cause?: unknown
  } = { code: 'P2002', meta: { target: ['machine_no'] } }
  const machineWrapper: { code: string; cause?: unknown } = { code: 'OTHER' }
  machineWrapper.cause = machineNode
  machineNode.cause = machineWrapper

  const machineFixture = serviceFixture('valid')
  let machineAttempts = 0
  machineFixture.dependencies.db = {
    $transaction: async () => {
      machineAttempts += 1
      throw machineWrapper
    },
  } as never
  await assert.rejects(
    createInspectionBatch(machineFixture.input, { userId: 'user-1' }, machineFixture.dependencies),
    (error: unknown) => error === machineWrapper,
  )
  assert.equal(machineAttempts, 1)
})

test('equipment route preserves role, response, and error contracts while delegating mutations', () => {
  const source = readFileSync(
    new URL('../src/app/api/equipment/route.ts', import.meta.url),
    'utf8',
  )
  assert.match(source, /requireRole\(\['admin', 'quality_manager', 'engineer'\]\)/)
  assert.match(source, /const updated = await updateEquipment\(/)
  assert.match(source, /await deleteEquipment\(/)
  assert.match(source, /NextResponse\.json\(\{ equipment: updated \}\)/)
  assert.match(source, /NextResponse\.json\(\{ success: true \}\)/)
  assert.doesNotMatch(source, /requireOwnershipOrAdmin/)
})
