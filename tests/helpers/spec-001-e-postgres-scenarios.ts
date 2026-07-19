import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createInspectionBatch } from '../../src/lib/inspection-integrity-service'
import { InspectionDomainError } from '../../src/lib/inspection-errors'
import { logAudit } from '../../src/lib/audit'
import {
  deleteEquipment,
  EquipmentMutationError,
  updateEquipment,
} from '../../src/lib/equipment-mutation-service'
import {
  createInstallation,
  removeInstallation,
} from '../../src/lib/installation-mutation-service'
import type { BatchInspectionRequest } from '../../src/lib/inspection-integrity'
import type { Spec001EPostgresFixture } from './spec-001-e-postgres'

export type PostgresScenarioResult = {
  committedRecords: number
  committedItems: number
  successAudits: number
  integrityPreserved: boolean
  proof?: Record<string, unknown>
}

type Seed = Awaited<ReturnType<typeof seedScenario>>

type ProtectedScenarioLifecycle<TSeed, TResult> = {
  seed: () => Promise<TSeed>
  execute: (seed: TSeed) => Promise<TResult>
  cleanup: () => Promise<void>
}

export async function runProtectedScenarioLifecycle<TSeed, TResult>(
  lifecycle: ProtectedScenarioLifecycle<TSeed, TResult>,
): Promise<TResult> {
  let outcome:
    | { ok: true; value: TResult }
    | { ok: false; error: unknown }
    | undefined
  let cleanupError: unknown

  try {
    const seed = await lifecycle.seed()
    outcome = { ok: true, value: await lifecycle.execute(seed) }
  } catch (error) {
    outcome = { ok: false, error }
  } finally {
    try {
      await lifecycle.cleanup()
    } catch (error) {
      cleanupError = error
    }
  }

  if (!outcome) throw new Error('SPEC-001-E scenario lifecycle produced no outcome')
  if (!outcome.ok && cleanupError) {
    throw new AggregateError(
      [outcome.error, cleanupError],
      'SPEC-001-E scenario execution and cleanup both failed',
    )
  }
  if (!outcome.ok) throw outcome.error
  if (cleanupError) throw cleanupError
  return outcome.value
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function withTimeout<T>(promise: Promise<T>, label: string, milliseconds = 5_000) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function remainsPending(promise: Promise<unknown>, milliseconds = 100) {
  const state = await Promise.race([
    promise.then(() => 'settled', () => 'settled'),
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), milliseconds)),
  ])
  return state === 'pending'
}

function scenarioSuffix(runId: string) {
  return runId.replace(/[^a-zA-Z0-9]/g, '').slice(-20)
}

async function seedScenario(fixture: Spec001EPostgresFixture, runId: string) {
  const { prisma } = fixture
  const suffix = scenarioSuffix(runId)
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@spec001e.test`,
      password: 'integration-test-only',
      name: `SPEC E ${suffix}`,
      role: 'inspector',
      active: true,
    },
  })
  const category = await prisma.part_category.create({
    data: { name: `Category ${suffix}`, code: `C${suffix}`, created_by: user.id },
  })
  const wrongCategory = await prisma.part_category.create({
    data: { name: `Wrong ${suffix}`, code: `W${suffix}`, created_by: user.id },
  })
  const part = await prisma.part.create({
    data: { code: `P${suffix}`, name: `Part ${suffix}`, category_id: category.id, created_by: user.id },
  })
  const revision = await prisma.part_revision.create({
    data: {
      id: randomUUID(),
      part_id: part.id,
      revision_no: 'A',
      revision_seq: 1,
      lifecycle_state: 'released',
      released_at: new Date(),
      released_by: user.id,
      created_by: user.id,
    },
  })
  const replacementRevision = await prisma.part_revision.create({
    data: {
      id: randomUUID(),
      part_id: part.id,
      revision_no: 'B',
      revision_seq: 2,
      lifecycle_state: 'released',
      released_at: new Date(),
      released_by: user.id,
      created_by: user.id,
    },
  })
  const template = await prisma.parameter_template.create({
    data: { category_id: category.id, name: `Template ${suffix}`, created_by: user.id },
  })
  const parameter = await prisma.parameter_item.create({
    data: {
      template_id: template.id,
      param_code: `M${suffix}`,
      param_name: 'Measurement',
      data_type: 'number',
      standard_min: 0,
      standard_max: 10,
    },
  })
  const wrongTemplate = await prisma.parameter_template.create({
    data: { category_id: wrongCategory.id, name: `Wrong template ${suffix}`, created_by: user.id },
  })
  const wrongParameter = await prisma.parameter_item.create({
    data: {
      template_id: wrongTemplate.id,
      param_code: `X${suffix}`,
      param_name: 'Wrong measurement',
      data_type: 'number',
    },
  })
  const equipment = await prisma.equipment.create({
    data: { machine_no: `EQ${suffix}`, model: 'SPEC-001-E', created_by: user.id },
  })
  const inspectionDate = new Date(Date.now() - 60_000)
  const installation = await prisma.equipment_part_installation.create({
    data: {
      id: randomUUID(),
      equipment_id: equipment.id,
      part_revision_id: revision.id,
      installed_at: new Date(inspectionDate.getTime() - 86_400_000),
      created_by: user.id,
    },
  })

  return {
    user,
    category,
    wrongCategory,
    part,
    revision,
    replacementRevision,
    template,
    parameter,
    wrongTemplate,
    wrongParameter,
    equipment,
    installation,
    inspectionDate,
  }
}

function requestFor(seed: Seed, items?: BatchInspectionRequest['items']): BatchInspectionRequest {
  return {
    record: {
      equipment_id: seed.equipment.id,
      inspection_date: seed.inspectionDate.toISOString(),
      batch_no: seed.user.id,
    },
    items: items ?? [{
      part_revision_id: seed.revision.id,
      param_item_id: seed.parameter.id,
      value_number: 5,
      value_text: null,
    }],
  }
}

async function counts(seed: Seed, fixture: Spec001EPostgresFixture) {
  const records = await fixture.prisma.inspection_record.findMany({
    where: { batch_no: seed.user.id },
    select: { id: true },
  })
  const recordIds = records.map((record) => record.id)
  const [committedItems, successAudits] = await Promise.all([
    fixture.prisma.inspection_data_item.count({ where: { record_id: { in: recordIds } } }),
    fixture.prisma.auditLog.count({
      where: {
        userId: seed.user.id,
        action: 'CREATE',
        entityType: 'inspection_record',
        entityId: { in: recordIds },
      },
    }),
  ])
  return { committedRecords: records.length, committedItems, successAudits }
}

async function cleanupScenarioByRunId(runId: string, fixture: Spec001EPostgresFixture) {
  const { prisma } = fixture
  const suffix = scenarioSuffix(runId)
  const user = await prisma.user.findUnique({
    where: { email: `${suffix}@spec001e.test` },
    select: { id: true },
  })
  if (!user) return

  const [records, templates] = await Promise.all([
    prisma.inspection_record.findMany({ where: { user_id: user.id }, select: { id: true } }),
    prisma.parameter_template.findMany({ where: { created_by: user.id }, select: { id: true } }),
  ])
  const recordIds = records.map((record) => record.id)
  const templateIds = templates.map((template) => template.id)

  await prisma.inspection_data_item.deleteMany({ where: { record_id: { in: recordIds } } })
  await prisma.auditLog.deleteMany({ where: { userId: user.id } })
  await prisma.inspection_record.deleteMany({ where: { id: { in: recordIds } } })
  await prisma.equipment_part_installation.deleteMany({ where: { created_by: user.id } })
  await prisma.parameter_item.deleteMany({ where: { template_id: { in: templateIds } } })
  await prisma.parameter_template.deleteMany({ where: { id: { in: templateIds } } })
  await prisma.part_revision.deleteMany({ where: { created_by: user.id } })
  await prisma.part.deleteMany({ where: { created_by: user.id } })
  await prisma.equipment.deleteMany({ where: { created_by: user.id } })
  await prisma.part_category.deleteMany({ where: { created_by: user.id } })
  await prisma.user.delete({ where: { id: user.id } })
}

async function removalScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const writerReady = deferred()
  const releaseWriter = deferred()
  const writer = fixture.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "equipment" WHERE id = ${seed.equipment.id} FOR UPDATE`)
    await tx.equipment_part_installation.update({
      where: { id: seed.installation.id },
      data: { removed_at: seed.inspectionDate, status: 'removed' },
    })
    writerReady.resolve()
    await releaseWriter.promise
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  await writerReady.promise
  const batch = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
    db: fixture.prisma,
    random: () => 0,
    sleep: async () => undefined,
  })
  const batchOutcome = batch.then(
    () => ({ error: undefined }),
    (error: unknown) => ({ error }),
  )
  const batchWaitedForEquipment = await remainsPending(batchOutcome)
  releaseWriter.resolve()
  await writer
  const { error } = await batchOutcome
  assert.equal(
    error instanceof InspectionDomainError && error.code === 'INSTALLATION_NOT_ELIGIBLE',
    true,
  )

  return {
    ...await counts(seed, fixture),
    integrityPreserved: batchWaitedForEquipment,
    proof: { batchWaitedForEquipment, rejectedAfterRemoval: true },
  }
}

async function replacementScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const releaseInstallationBlocker = deferred()
  const installationBlocked = deferred()
  const blocker = fixture.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "equipment_part_installation"
      WHERE id = ${seed.installation.id}::uuid FOR UPDATE
    `)
    installationBlocked.resolve()
    await releaseInstallationBlocker.promise
  })
  await installationBlocked.promise

  const batch = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
    db: fixture.prisma,
    random: () => 0,
    sleep: async () => undefined,
  })
  const batchWaitedForInstallation = await remainsPending(batch)

  let writerAcquiredEquipment = false
  const writer = fixture.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "equipment" WHERE id = ${seed.equipment.id} FOR UPDATE`)
    writerAcquiredEquipment = true
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "equipment_part_installation"
      WHERE id = ${seed.installation.id}::uuid FOR UPDATE
    `)
    await tx.equipment_part_installation.update({
      where: { id: seed.installation.id },
      data: { removed_at: new Date(seed.inspectionDate.getTime() + 1), status: 'removed' },
    })
    await tx.equipment_part_installation.create({
      data: {
        id: randomUUID(),
        equipment_id: seed.equipment.id,
        part_revision_id: seed.replacementRevision.id,
        installed_at: new Date(seed.inspectionDate.getTime() + 1),
        created_by: seed.user.id,
      },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  const writerWaitedForEquipment = await remainsPending(writer)
  const equipmentLockWasExclusive = !writerAcquiredEquipment

  releaseInstallationBlocker.resolve()
  await blocker
  await batch
  await writer

  return {
    ...await counts(seed, fixture),
    integrityPreserved: batchWaitedForInstallation
      && writerWaitedForEquipment
      && equipmentLockWasExclusive,
    proof: {
      lockOrder: ['equipment', 'installation'],
      batchWaitedForInstallation,
      writerWaitedForEquipment,
      equipmentLockWasExclusive,
    },
  }
}

async function rollbackScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const input = requestFor(seed, [
    {
      part_revision_id: seed.revision.id,
      param_item_id: seed.parameter.id,
      value_number: 5,
      value_text: null,
    },
    {
      part_revision_id: seed.revision.id,
      param_item_id: seed.wrongParameter.id,
      value_number: 5,
      value_text: null,
    },
  ])
  await assert.rejects(
    createInspectionBatch(input, { userId: seed.user.id }, { db: fixture.prisma }),
    (error: unknown) => error instanceof InspectionDomainError
      && error.code === 'PARAMETER_CATEGORY_MISMATCH',
  )
  const result = await counts(seed, fixture)
  return {
    ...result,
    integrityPreserved: result.committedRecords === 0
      && result.committedItems === 0
      && result.successAudits === 0,
    proof: { failedItemRolledBackWholeBatch: true },
  }
}

async function recordNumberScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const first = requestFor(seed)
  first.record.batch_no = `${seed.user.id}-1`
  const second = requestFor(seed)
  second.record.batch_no = `${seed.user.id}-2`
  const records = await Promise.all([
    createInspectionBatch(first, { userId: seed.user.id }, { db: fixture.prisma }),
    createInspectionBatch(second, { userId: seed.user.id }, { db: fixture.prisma }),
  ])
  const uniqueNumbers = new Set(records.map((record) => record.record_no))
  const committedItems = await fixture.prisma.inspection_data_item.count({
    where: { record_id: { in: records.map((record) => record.id) } },
  })
  const successAudits = await fixture.prisma.auditLog.count({
    where: { entityId: { in: records.map((record) => record.id) }, entityType: 'inspection_record' },
  })
  return {
    committedRecords: records.length,
    committedItems,
    successAudits,
    integrityPreserved: uniqueNumbers.size === 2,
    proof: { recordNumbers: [...uniqueNumbers], duplicateSuccess: false },
  }
}

const equipmentActor = (seed: Seed) => ({
  id: seed.user.id,
  role: 'engineer' as const,
})

const installationDependencies = (fixture: Spec001EPostgresFixture) => ({
  db: fixture.prisma,
  audit: logAudit,
  random: () => 0,
  sleep: async () => undefined,
})

async function installationAuditCount(seed: Seed, fixture: Spec001EPostgresFixture) {
  return fixture.prisma.auditLog.count({
    where: {
      userId: seed.user.id,
      entityType: 'equipment_part_installation',
    },
  })
}

function auditObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, Prisma.JsonValue>
}

function auditDate(value: Prisma.JsonValue | undefined) {
  assert.equal(typeof value, 'string')
  return new Date(value as string)
}

async function installationPostCreateAuditRollbackScenario(
  seed: Seed,
  fixture: Spec001EPostgresFixture,
) {
  await fixture.prisma.equipment_part_installation.update({
    where: { id: seed.installation.id },
    data: { status: 'removed', removed_at: seed.inspectionDate },
  })
  await assert.rejects(createInstallation({
    equipmentId: seed.equipment.id,
    partRevisionId: seed.replacementRevision.id,
    installedAt: new Date(seed.inspectionDate.getTime() + 1),
    remark: 'PG-INST-01',
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async () => { throw new Error('forced installation CREATE audit failure') },
  }), /forced installation CREATE audit failure/)
  const [activeRows, totalRows, successAudits] = await Promise.all([
    fixture.prisma.equipment_part_installation.count({
      where: { equipment_id: seed.equipment.id, status: 'active', removed_at: null },
    }),
    fixture.prisma.equipment_part_installation.count({ where: { equipment_id: seed.equipment.id } }),
    installationAuditCount(seed, fixture),
  ])
  return {
    committedRecords: 0,
    committedItems: 0,
    successAudits,
    integrityPreserved: activeRows === 0 && totalRows === 1 && successAudits === 0,
    proof: { activeRows, totalRows, successAudits },
  }
}

async function installationPostReplacementAuditRollbackScenario(
  seed: Seed,
  fixture: Spec001EPostgresFixture,
) {
  const before = await fixture.prisma.equipment_part_installation.findUniqueOrThrow({
    where: { id: seed.installation.id },
  })
  await assert.rejects(createInstallation({
    equipmentId: seed.equipment.id,
    partRevisionId: seed.replacementRevision.id,
    installedAt: seed.inspectionDate,
    remark: 'PG-INST-02',
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async (params) => {
      if (params.action === 'UPDATE') throw new Error('forced replacement audit failure')
      throw new Error('CREATE audit must not be reached')
    },
  }), /forced replacement audit failure/)
  const [after, newRows, successAudits] = await Promise.all([
    fixture.prisma.equipment_part_installation.findUniqueOrThrow({ where: { id: seed.installation.id } }),
    fixture.prisma.equipment_part_installation.count({
      where: { equipment_id: seed.equipment.id, part_revision_id: seed.replacementRevision.id },
    }),
    installationAuditCount(seed, fixture),
  ])
  const oldUnchanged = JSON.stringify(after) === JSON.stringify(before)
  return {
    committedRecords: 0,
    committedItems: 0,
    successAudits,
    integrityPreserved: oldUnchanged && newRows === 0 && successAudits === 0,
    proof: { oldUnchanged, newRows, successAudits },
  }
}

async function batchAndInstallationPostLockScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const batchAtAudit = deferred()
  const releaseBatch = deferred()
  const installedAt = new Date(seed.inspectionDate.getTime() + 1)
  const batch = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
    db: fixture.prisma,
    audit: async (params, tx) => {
      batchAtAudit.resolve()
      await withTimeout(releaseBatch.promise, 'release PG-INST-03 Batch barrier')
      return logAudit(params, tx)
    },
  })
  let post: ReturnType<typeof createInstallation> | undefined
  try {
    await withTimeout(batchAtAudit.promise, 'PG-INST-03 Batch audit barrier')
    post = createInstallation({
      equipmentId: seed.equipment.id,
      partRevisionId: seed.replacementRevision.id,
      installedAt,
      remark: 'PG-INST-03',
      actor: equipmentActor(seed),
    }, installationDependencies(fixture))
    const postWaitedForBatch = await remainsPending(post)
    assert.equal(postWaitedForBatch, true)
    releaseBatch.resolve()
    const [record, installation] = await Promise.all([
      withTimeout(batch, 'PG-INST-03 Batch completion'),
      withTimeout(post, 'PG-INST-03 POST completion'),
    ])
    const [persistedRecord, persistedInstallation, persistedOld, installationCreateAudits,
      installationUpdateAudits, batchAudits] = await Promise.all([
      fixture.prisma.inspection_record.findUnique({
        where: { id: record.id },
        include: { data_items: true },
      }),
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: installation.id } }),
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: seed.installation.id } }),
      fixture.prisma.auditLog.findMany({
        where: {
          userId: seed.user.id,
          action: 'CREATE',
          entityType: 'equipment_part_installation',
          entityId: installation.id,
        },
      }),
      fixture.prisma.auditLog.findMany({
        where: {
          userId: seed.user.id,
          action: 'UPDATE',
          entityType: 'equipment_part_installation',
          entityId: seed.installation.id,
        },
      }),
      fixture.prisma.auditLog.findMany({
        where: {
          userId: seed.user.id,
          action: 'CREATE',
          entityType: 'inspection_record',
          entityId: record.id,
        },
      }),
    ])
    assert.ok(persistedRecord)
    assert.equal(persistedRecord.data_items.length, 1)
    assert.ok(persistedInstallation)
    assert.equal(persistedInstallation.equipment_id, seed.equipment.id)
    assert.equal(persistedInstallation.part_revision_id, seed.replacementRevision.id)
    assert.equal(persistedInstallation.status, 'active')
    assert.equal(persistedInstallation.removed_at, null)
    assert.equal(persistedInstallation.installed_at.getTime(), installedAt.getTime())
    assert.ok(persistedOld)
    assert.equal(persistedOld.status, 'removed')
    assert.equal(persistedOld.removed_at?.getTime(), installedAt.getTime())

    assert.equal(installationCreateAudits.length, 1)
    const createAfter = auditObject(installationCreateAudits[0].after)
    assert.equal(createAfter.equipment_id, seed.equipment.id)
    assert.equal(createAfter.part_revision_id, seed.replacementRevision.id)
    assert.equal(auditDate(createAfter.installed_at).getTime(), installedAt.getTime())
    assert.equal(createAfter.status, 'active')
    assert.equal(installationUpdateAudits.length, 1)
    const updateAfter = auditObject(installationUpdateAudits[0].after)
    assert.equal(updateAfter.status, 'removed')
    assert.equal(auditDate(updateAfter.removed_at).getTime(), installedAt.getTime())

    assert.equal(batchAudits.length, 1)
    const batchAfter = auditObject(batchAudits[0].after)
    assert.equal(batchAfter.record_no, persistedRecord.record_no)
    assert.equal(batchAfter.item_count, 1)

    const batchCounts = await counts(seed, fixture)
    return {
      ...batchCounts,
      integrityPreserved: postWaitedForBatch
        && batchCounts.committedRecords === 1
        && batchCounts.committedItems === 1
        && batchCounts.successAudits === 1,
      proof: {
        postWaitedForBatch,
        recordId: record.id,
        installationId: installation.id,
        installationCreateAudits: installationCreateAudits.length,
        installationUpdateAudits: installationUpdateAudits.length,
        batchAudits: batchAudits.length,
      },
    }
  } finally {
    releaseBatch.resolve()
    await Promise.allSettled([batch, ...(post ? [post] : [])])
  }
}

async function replacementBeforeBatchRevalidationScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const postAtCreateAudit = deferred()
  const releasePost = deferred()
  const replacementAt = new Date(seed.inspectionDate.getTime() - 1_000)
  const post = createInstallation({
    equipmentId: seed.equipment.id,
    partRevisionId: seed.replacementRevision.id,
    installedAt: replacementAt,
    remark: 'PG-INST-04',
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async (params, tx) => {
      if (params.action === 'CREATE') {
        postAtCreateAudit.resolve()
        await withTimeout(releasePost.promise, 'release PG-INST-04 POST barrier')
      }
      return logAudit(params, tx)
    },
  })
  let batchOutcome: Promise<{ error: unknown }> | undefined
  try {
    await withTimeout(postAtCreateAudit.promise, 'PG-INST-04 CREATE audit barrier')
    batchOutcome = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
      db: fixture.prisma,
      random: () => 0,
      sleep: async () => undefined,
    }).then(() => ({ error: undefined }), (error: unknown) => ({ error }))
    const batchWaitedForPost = await remainsPending(batchOutcome)
    assert.equal(batchWaitedForPost, true)
    releasePost.resolve()
    const [installation, { error }] = await Promise.all([
      withTimeout(post, 'PG-INST-04 POST completion'),
      withTimeout(batchOutcome, 'PG-INST-04 Batch completion'),
    ])
    const [countsAfter, persistedOld, persistedNew, oldUpdateAudits, newCreateAudits] = await Promise.all([
      counts(seed, fixture),
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: seed.installation.id } }),
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: installation.id } }),
      fixture.prisma.auditLog.findMany({
        where: {
          userId: seed.user.id,
          action: 'UPDATE',
          entityType: 'equipment_part_installation',
          entityId: seed.installation.id,
        },
      }),
      fixture.prisma.auditLog.findMany({
        where: {
          userId: seed.user.id,
          action: 'CREATE',
          entityType: 'equipment_part_installation',
          entityId: installation.id,
        },
      }),
    ])
    const rejected = error instanceof InspectionDomainError
      && error.code === 'INSTALLATION_NOT_ELIGIBLE'
    assert.ok(persistedOld)
    assert.equal(persistedOld.equipment_id, seed.equipment.id)
    assert.equal(persistedOld.part_revision_id, seed.revision.id)
    assert.equal(persistedOld.installed_at.getTime(), seed.installation.installed_at.getTime())
    assert.equal(persistedOld.status, 'removed')
    assert.equal(persistedOld.removed_at?.getTime(), replacementAt.getTime())
    assert.ok(persistedNew)
    assert.equal(persistedNew.equipment_id, seed.equipment.id)
    assert.equal(persistedNew.part_revision_id, seed.replacementRevision.id)
    assert.equal(persistedNew.installed_at.getTime(), replacementAt.getTime())
    assert.equal(persistedNew.status, 'active')
    assert.equal(persistedNew.removed_at, null)

    assert.equal(oldUpdateAudits.length, 1)
    const oldBefore = auditObject(oldUpdateAudits[0].before)
    const oldAfter = auditObject(oldUpdateAudits[0].after)
    assert.equal(oldBefore.status, 'active')
    assert.equal(oldBefore.removed_at, null)
    assert.equal(oldAfter.status, 'removed')
    assert.equal(auditDate(oldAfter.removed_at).getTime(), replacementAt.getTime())
    assert.equal(newCreateAudits.length, 1)
    const newAfter = auditObject(newCreateAudits[0].after)
    assert.equal(newAfter.equipment_id, seed.equipment.id)
    assert.equal(newAfter.part_revision_id, seed.replacementRevision.id)
    assert.equal(auditDate(newAfter.installed_at).getTime(), replacementAt.getTime())
    assert.equal(newAfter.status, 'active')
    return {
      ...countsAfter,
      integrityPreserved: batchWaitedForPost && rejected
        && countsAfter.committedRecords === 0
        && countsAfter.committedItems === 0
        && countsAfter.successAudits === 0,
      proof: {
        batchWaitedForPost,
        rejected,
        oldUpdateAudits: oldUpdateAudits.length,
        newCreateAudits: newCreateAudits.length,
        ...countsAfter,
      },
    }
  } finally {
    releasePost.resolve()
    await Promise.allSettled([post, ...(batchOutcome ? [batchOutcome] : [])])
  }
}

async function removalBeforeBatchRevalidationScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const putAtAudit = deferred()
  const releasePut = deferred()
  const removedAt = new Date(seed.inspectionDate.getTime() - 1_000)
  const put = removeInstallation({
    equipmentId: seed.equipment.id,
    installationId: seed.installation.id,
    removedAt,
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async (params, tx) => {
      putAtAudit.resolve()
      await withTimeout(releasePut.promise, 'release PG-INST-05 PUT barrier')
      return logAudit(params, tx)
    },
  })
  let batchOutcome: Promise<{ error: unknown }> | undefined
  try {
    await withTimeout(putAtAudit.promise, 'PG-INST-05 PUT audit barrier')
    batchOutcome = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
      db: fixture.prisma,
      random: () => 0,
      sleep: async () => undefined,
    }).then(() => ({ error: undefined }), (error: unknown) => ({ error }))
    const batchWaitedForPut = await remainsPending(batchOutcome)
    assert.equal(batchWaitedForPut, true)
    releasePut.resolve()
    const [removed, { error }] = await Promise.all([
      withTimeout(put, 'PG-INST-05 PUT completion'),
      withTimeout(batchOutcome, 'PG-INST-05 Batch completion'),
    ])
    const [countsAfter, successAudits] = await Promise.all([
      counts(seed, fixture),
      installationAuditCount(seed, fixture),
    ])
    const rejected = error instanceof InspectionDomainError
      && error.code === 'INSTALLATION_NOT_ELIGIBLE'
    return {
      ...countsAfter,
      successAudits,
      integrityPreserved: removed.removed_at?.getTime() === removedAt.getTime()
        && batchWaitedForPut && rejected
        && countsAfter.committedRecords === 0
        && countsAfter.committedItems === 0
        && successAudits === 1,
      proof: { batchWaitedForPut, rejected, successAudits },
    }
  } finally {
    releasePut.resolve()
    await Promise.allSettled([put, ...(batchOutcome ? [batchOutcome] : [])])
  }
}

async function installationPutAuditRollbackScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const before = await fixture.prisma.equipment_part_installation.findUniqueOrThrow({
    where: { id: seed.installation.id },
  })
  await assert.rejects(removeInstallation({
    equipmentId: seed.equipment.id,
    installationId: seed.installation.id,
    removedAt: seed.inspectionDate,
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async () => { throw new Error('forced installation PUT audit failure') },
  }), /forced installation PUT audit failure/)
  const [after, successAudits] = await Promise.all([
    fixture.prisma.equipment_part_installation.findUniqueOrThrow({ where: { id: seed.installation.id } }),
    installationAuditCount(seed, fixture),
  ])
  const unchanged = JSON.stringify(after) === JSON.stringify(before)
  return {
    committedRecords: 0,
    committedItems: 0,
    successAudits,
    integrityPreserved: unchanged && successAudits === 0,
    proof: { unchanged, successAudits },
  }
}

async function concurrentInstallationPostScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const firstAtCreateAudit = deferred()
  const releaseFirst = deferred()
  const firstAt = new Date(seed.inspectionDate.getTime() - 2_000)
  const secondAt = new Date(seed.inspectionDate.getTime() - 1_000)
  const firstActor = equipmentActor(seed)
  const secondActor = equipmentActor(seed)
  const first = createInstallation({
    equipmentId: seed.equipment.id,
    partRevisionId: seed.replacementRevision.id,
    installedAt: firstAt,
    remark: 'PG-INST-07-A',
    actor: firstActor,
  }, {
    ...installationDependencies(fixture),
    audit: async (params, tx) => {
      if (params.action === 'CREATE') {
        firstAtCreateAudit.resolve()
        await withTimeout(releaseFirst.promise, 'release PG-INST-07 first POST')
      }
      return logAudit(params, tx)
    },
  })
  let second: ReturnType<typeof createInstallation> | undefined
  try {
    await withTimeout(firstAtCreateAudit.promise, 'PG-INST-07 first CREATE audit barrier')
    second = createInstallation({
      equipmentId: seed.equipment.id,
      partRevisionId: seed.revision.id,
      installedAt: secondAt,
      remark: 'PG-INST-07-B',
      actor: secondActor,
    }, installationDependencies(fixture))
    const secondWaitedForFirst = await remainsPending(second)
    assert.equal(secondWaitedForFirst, true)
    releaseFirst.resolve()
    const [firstRow, secondRow] = await Promise.all([
      withTimeout(first, 'PG-INST-07 first POST completion'),
      withTimeout(second, 'PG-INST-07 second POST completion'),
    ])
    const [persistedFirst, persistedSecond, activeRows, audits] = await Promise.all([
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: firstRow.id } }),
      fixture.prisma.equipment_part_installation.findUnique({ where: { id: secondRow.id } }),
      fixture.prisma.equipment_part_installation.findMany({
        where: {
          equipment_id: seed.equipment.id,
          part_revision: { part_id: seed.part.id },
          status: 'active',
          removed_at: null,
        },
      }),
      fixture.prisma.auditLog.findMany({
        where: { userId: seed.user.id, entityType: 'equipment_part_installation' },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    assert.ok(persistedFirst)
    assert.equal(persistedFirst.installed_at.getTime(), firstAt.getTime())
    assert.equal(persistedFirst.status, 'removed')
    assert.equal(persistedFirst.removed_at?.getTime(), secondAt.getTime())
    assert.ok(persistedSecond)
    assert.equal(persistedSecond.installed_at.getTime(), secondAt.getTime())
    assert.equal(persistedSecond.status, 'active')
    assert.equal(persistedSecond.removed_at, null)

    const seedUpdateAudits = audits.filter((audit) => (
      audit.userId === firstActor.id
      && audit.action === 'UPDATE'
      && audit.entityId === seed.installation.id
    ))
    const firstCreateAudits = audits.filter((audit) => (
      audit.userId === firstActor.id
      && audit.action === 'CREATE'
      && audit.entityId === firstRow.id
    ))
    const firstUpdateAudits = audits.filter((audit) => (
      audit.userId === secondActor.id
      && audit.action === 'UPDATE'
      && audit.entityId === firstRow.id
    ))
    const secondCreateAudits = audits.filter((audit) => (
      audit.userId === secondActor.id
      && audit.action === 'CREATE'
      && audit.entityId === secondRow.id
    ))
    assert.equal(seedUpdateAudits.length, 1)
    assert.equal(firstCreateAudits.length, 1)
    const firstCreateAfter = auditObject(firstCreateAudits[0].after)
    assert.equal(firstCreateAfter.status, 'active')
    assert.equal(auditDate(firstCreateAfter.installed_at).getTime(), firstAt.getTime())
    assert.equal(firstUpdateAudits.length, 1)
    const firstUpdateBefore = auditObject(firstUpdateAudits[0].before)
    const firstUpdateAfter = auditObject(firstUpdateAudits[0].after)
    assert.equal(firstUpdateBefore.status, 'active')
    assert.equal(firstUpdateBefore.removed_at, null)
    assert.equal(firstUpdateAfter.status, 'removed')
    assert.equal(auditDate(firstUpdateAfter.removed_at).getTime(), secondAt.getTime())
    assert.equal(secondCreateAudits.length, 1)
    const secondCreateAfter = auditObject(secondCreateAudits[0].after)
    assert.equal(secondCreateAfter.status, 'active')
    assert.equal(auditDate(secondCreateAfter.installed_at).getTime(), secondAt.getTime())
    return {
      committedRecords: 0,
      committedItems: 0,
      successAudits: audits.length,
      integrityPreserved: secondWaitedForFirst
        && activeRows.length === 1
        && activeRows[0].id === secondRow.id
        && audits.length === 4
        && firstRow.id !== secondRow.id,
      proof: {
        secondWaitedForFirst,
        activeIds: activeRows.map((row) => row.id),
        seedUpdateAudits: seedUpdateAudits.length,
        firstCreateAudits: firstCreateAudits.length,
        firstUpdateAudits: firstUpdateAudits.length,
        secondCreateAudits: secondCreateAudits.length,
      },
    }
  } finally {
    releaseFirst.resolve()
    await Promise.allSettled([first, ...(second ? [second] : [])])
  }
}

async function concurrentInstallationPutScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const firstAtAudit = deferred()
  const releaseFirst = deferred()
  const firstAt = new Date(seed.inspectionDate.getTime() - 2_000)
  const secondAt = new Date(seed.inspectionDate.getTime() - 1_000)
  const first = removeInstallation({
    equipmentId: seed.equipment.id,
    installationId: seed.installation.id,
    removedAt: firstAt,
    actor: equipmentActor(seed),
  }, {
    ...installationDependencies(fixture),
    audit: async (params, tx) => {
      firstAtAudit.resolve()
      await withTimeout(releaseFirst.promise, 'release PG-INST-08 first PUT')
      return logAudit(params, tx)
    },
  })
  let second: ReturnType<typeof removeInstallation> | undefined
  try {
    await withTimeout(firstAtAudit.promise, 'PG-INST-08 first PUT audit barrier')
    second = removeInstallation({
      equipmentId: seed.equipment.id,
      installationId: seed.installation.id,
      removedAt: secondAt,
      actor: equipmentActor(seed),
    }, installationDependencies(fixture))
    const secondWaitedForFirst = await remainsPending(second)
    assert.equal(secondWaitedForFirst, true)
    releaseFirst.resolve()
    const [firstRow, secondRow] = await Promise.all([
      withTimeout(first, 'PG-INST-08 first PUT completion'),
      withTimeout(second, 'PG-INST-08 second PUT completion'),
    ])
    const [persisted, successAudits] = await Promise.all([
      fixture.prisma.equipment_part_installation.findUniqueOrThrow({ where: { id: seed.installation.id } }),
      installationAuditCount(seed, fixture),
    ])
    return {
      committedRecords: 0,
      committedItems: 0,
      successAudits,
      integrityPreserved: secondWaitedForFirst
        && persisted.removed_at?.getTime() === firstAt.getTime()
        && firstRow.removed_at?.getTime() === firstAt.getTime()
        && secondRow.removed_at?.getTime() === firstAt.getTime()
        && successAudits === 1,
      proof: { secondWaitedForFirst, removedAt: persisted.removed_at, successAudits },
    }
  } finally {
    releaseFirst.resolve()
    await Promise.allSettled([first, ...(second ? [second] : [])])
  }
}

async function equipmentPutAuditRollbackScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const before = await fixture.prisma.equipment.findUniqueOrThrow({
    where: { id: seed.equipment.id },
  })
  await assert.rejects(updateEquipment({
    equipmentId: seed.equipment.id,
    data: { status: '停用', remark: 'must roll back' },
    actor: equipmentActor(seed),
  }, {
    db: fixture.prisma,
    audit: async () => { throw new Error('forced equipment PUT audit failure') },
  }), /forced equipment PUT audit failure/)
  const after = await fixture.prisma.equipment.findUniqueOrThrow({
    where: { id: seed.equipment.id },
  })
  const successAudits = await fixture.prisma.auditLog.count({
    where: {
      userId: seed.user.id,
      action: 'UPDATE',
      entityType: 'equipment',
      entityId: seed.equipment.id,
    },
  })
  const integrityPreserved = successAudits === 0
    && JSON.stringify(after) === JSON.stringify(before)
  return {
    committedRecords: 0,
    committedItems: 0,
    successAudits,
    integrityPreserved,
    proof: { equipmentUnchanged: JSON.stringify(after) === JSON.stringify(before) },
  }
}

async function equipmentDeleteAuditRollbackScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const suffix = fixture.runId.replace(/[^a-zA-Z0-9]/g, '').slice(-16)
  const deletable = await fixture.prisma.equipment.create({
    data: {
      machine_no: `DEL${suffix}`,
      model: 'SPEC-001-E DELETE',
      created_by: seed.user.id,
    },
  })
  await assert.rejects(deleteEquipment({
    equipmentId: deletable.id,
    actor: equipmentActor(seed),
  }, {
    db: fixture.prisma,
    audit: async () => { throw new Error('forced equipment DELETE audit failure') },
  }), /forced equipment DELETE audit failure/)
  const after = await fixture.prisma.equipment.findUnique({ where: { id: deletable.id } })
  const successAudits = await fixture.prisma.auditLog.count({
    where: {
      userId: seed.user.id,
      action: 'DELETE',
      entityType: 'equipment',
      entityId: deletable.id,
    },
  })
  const equipmentPreserved = JSON.stringify(after) === JSON.stringify(deletable)
  return {
    committedRecords: 0,
    committedItems: 0,
    successAudits,
    integrityPreserved: equipmentPreserved && successAudits === 0,
    proof: { equipmentPreserved },
  }
}

async function batchAndEquipmentPutLockScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const batchAtAudit = deferred()
  const releaseBatch = deferred()
  const batch = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
    db: fixture.prisma,
    audit: async (params, tx) => {
      batchAtAudit.resolve()
      await withTimeout(releaseBatch.promise, 'release Batch PUT barrier')
      return logAudit(params, tx)
    },
  })
  let update: Promise<Awaited<ReturnType<typeof updateEquipment>>> | undefined
  try {
    await withTimeout(batchAtAudit.promise, 'Batch reaching PUT audit barrier')
    update = updateEquipment({
      equipmentId: seed.equipment.id,
      data: { status: '停用' },
      actor: equipmentActor(seed),
    }, { db: fixture.prisma, audit: logAudit })
    const updateWaitedForBatch = await remainsPending(update)
    assert.equal(updateWaitedForBatch, true)
    releaseBatch.resolve()
    const [record, updated] = await Promise.all([
      withTimeout(batch, 'Batch completion after PUT barrier'),
      withTimeout(update, 'Equipment PUT completion after Batch'),
    ])
    const persistedRecord = await fixture.prisma.inspection_record.findUnique({
      where: { id: record.id },
    })
    const persistedEquipment = await fixture.prisma.equipment.findUnique({
      where: { id: seed.equipment.id },
    })
    return {
      ...await counts(seed, fixture),
      integrityPreserved: persistedRecord !== null && persistedEquipment?.status === updated.status,
      proof: { updateWaitedForBatch, status: persistedEquipment?.status },
    }
  } finally {
    releaseBatch.resolve()
    await Promise.allSettled([batch, ...(update ? [update] : [])])
  }
}

async function batchAndEquipmentDeleteLockScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const batchAtAudit = deferred()
  const releaseBatch = deferred()
  const batch = createInspectionBatch(requestFor(seed), { userId: seed.user.id }, {
    db: fixture.prisma,
    audit: async (params, tx) => {
      batchAtAudit.resolve()
      await withTimeout(releaseBatch.promise, 'release Batch DELETE barrier')
      return logAudit(params, tx)
    },
  })
  let deletion: Promise<void> | undefined
  try {
    await withTimeout(batchAtAudit.promise, 'Batch reaching DELETE audit barrier')
    deletion = deleteEquipment({
      equipmentId: seed.equipment.id,
      actor: equipmentActor(seed),
    }, { db: fixture.prisma, audit: logAudit })
    const deletionOutcome = deletion.then(
      () => ({ error: undefined }),
      (error: unknown) => ({ error }),
    )
    const deleteWaitedForBatch = await remainsPending(deletionOutcome)
    assert.equal(deleteWaitedForBatch, true)
    releaseBatch.resolve()
    const [record, { error }] = await Promise.all([
      withTimeout(batch, 'Batch completion after DELETE barrier'),
      withTimeout(deletionOutcome, 'Equipment DELETE completion after Batch'),
    ])
    assert.equal(error instanceof EquipmentMutationError, true)
    assert.equal((error as EquipmentMutationError).status, 409)
    assert.equal(
      (error as EquipmentMutationError).message,
      '该设备下尚有 1 条装配历史，请先移除相关装配记录',
    )
    const [equipment, persistedRecord, deleteSuccessAudits] = await Promise.all([
      fixture.prisma.equipment.findUnique({ where: { id: seed.equipment.id } }),
      fixture.prisma.inspection_record.findUnique({ where: { id: record.id } }),
      fixture.prisma.auditLog.count({
        where: {
          userId: seed.user.id,
          action: 'DELETE',
          entityType: 'equipment',
          entityId: seed.equipment.id,
        },
      }),
    ])
    return {
      ...await counts(seed, fixture),
      integrityPreserved: equipment !== null && persistedRecord !== null && deleteSuccessAudits === 0,
      proof: { deleteWaitedForBatch, deleteSuccessAudits },
    }
  } finally {
    releaseBatch.resolve()
    await Promise.allSettled([batch, ...(deletion ? [deletion] : [])])
  }
}

async function concurrentMachineNumberScenario(seed: Seed, fixture: Spec001EPostgresFixture) {
  const suffix = fixture.runId.replace(/[^a-zA-Z0-9]/g, '').slice(-14)
  const targetMachineNo = `RACE${suffix}`
  const equipment = await Promise.all([
    fixture.prisma.equipment.create({
      data: { machine_no: `R1${suffix}`, model: 'SPEC-001-E RACE', created_by: seed.user.id },
    }),
    fixture.prisma.equipment.create({
      data: { machine_no: `R2${suffix}`, model: 'SPEC-001-E RACE', created_by: seed.user.id },
    }),
  ])
  const equipmentIds = equipment.map((item) => item.id)
  const enteredAudit = deferred()
  const releaseAudit = deferred()
  const updateA = updateEquipment({
    equipmentId: equipment[0].id,
    data: { machine_no: targetMachineNo },
    normalizedMachineNo: targetMachineNo,
    conflictDisplayMachineNo: targetMachineNo,
    actor: equipmentActor(seed),
  }, {
    db: fixture.prisma,
    audit: async (params, tx) => {
      enteredAudit.resolve()
      await withTimeout(releaseAudit.promise, 'release machine number audit barrier')
      return logAudit(params, tx)
    },
  })
  let updateB: Promise<Awaited<ReturnType<typeof updateEquipment>>> | undefined
  try {
    await withTimeout(enteredAudit.promise, 'Equipment A reaching machine number audit barrier')
    updateB = updateEquipment({
      equipmentId: equipment[1].id,
      data: { machine_no: targetMachineNo },
      normalizedMachineNo: targetMachineNo,
      conflictDisplayMachineNo: targetMachineNo,
      actor: equipmentActor(seed),
    }, { db: fixture.prisma, audit: logAudit })
    const bWaitedForA = await remainsPending(updateB)
    assert.equal(bWaitedForA, true)
    releaseAudit.resolve()
    const outcomes = await Promise.allSettled([updateA, updateB])
    const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled')
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')
    assert.equal(successes.length, 1)
    assert.equal(failures.length, 1)
    assert.equal(
      failures[0].reason instanceof EquipmentMutationError
        && failures[0].reason.status === 409
        && failures[0].reason.message === `机头编号 "${targetMachineNo}" 已被其他设备使用`,
      true,
    )
    const [targetRows, successAudits] = await Promise.all([
      fixture.prisma.equipment.count({ where: { machine_no: targetMachineNo } }),
      fixture.prisma.auditLog.count({
        where: {
          userId: seed.user.id,
          action: 'UPDATE',
          entityType: 'equipment',
          entityId: { in: equipmentIds },
        },
      }),
    ])
    return {
      committedRecords: 0,
      committedItems: 0,
      successAudits,
      integrityPreserved: targetRows === 1 && successAudits === 1,
      proof: { successfulRequests: successes.length, targetRows, bWaitedForA },
    }
  } finally {
    releaseAudit.resolve()
    await Promise.allSettled([updateA, ...(updateB ? [updateB] : [])])
  }
}

async function executeScenario(
  seed: Seed,
  fixture: Spec001EPostgresFixture,
  scenario: string,
): Promise<PostgresScenarioResult> {
  if (scenario.startsWith('PG-INST-01')) return installationPostCreateAuditRollbackScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-02')) return installationPostReplacementAuditRollbackScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-03')) return batchAndInstallationPostLockScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-04')) return replacementBeforeBatchRevalidationScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-05')) return removalBeforeBatchRevalidationScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-06')) return installationPutAuditRollbackScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-07')) return concurrentInstallationPostScenario(seed, fixture)
  if (scenario.startsWith('PG-INST-08')) return concurrentInstallationPutScenario(seed, fixture)
  if (scenario.includes('PUT audit failure')) return equipmentPutAuditRollbackScenario(seed, fixture)
  if (scenario.includes('DELETE audit failure')) return equipmentDeleteAuditRollbackScenario(seed, fixture)
  if (scenario.includes('Batch and Equipment PUT')) return batchAndEquipmentPutLockScenario(seed, fixture)
  if (scenario.includes('Batch and Equipment DELETE')) return batchAndEquipmentDeleteLockScenario(seed, fixture)
  if (scenario.includes('concurrent equipment machine_no')) return concurrentMachineNumberScenario(seed, fixture)
  if (scenario.includes('installation removal')) return removalScenario(seed, fixture)
  if (scenario.includes('replacement')) return replacementScenario(seed, fixture)
  if (scenario.includes('rolls back')) return rollbackScenario(seed, fixture)
  if (scenario.includes('record_no')) return recordNumberScenario(seed, fixture)
  assert.fail(`Unknown SPEC-001-E PostgreSQL scenario: ${scenario}`)
}

export async function runSpec001EPostgresScenario(
  fixture: Spec001EPostgresFixture,
  scenario: string,
): Promise<PostgresScenarioResult> {
  const runId = fixture.runId
  return runProtectedScenarioLifecycle({
    seed: () => seedScenario(fixture, runId),
    execute: (seed) => executeScenario(seed, fixture, scenario),
    cleanup: () => cleanupScenarioByRunId(runId, fixture),
  })
}
