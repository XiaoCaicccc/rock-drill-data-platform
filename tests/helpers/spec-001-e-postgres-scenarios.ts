import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { createInspectionBatch } from '../../src/lib/inspection-integrity-service'
import { InspectionDomainError } from '../../src/lib/inspection-errors'
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

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function remainsPending(promise: Promise<unknown>, milliseconds = 100) {
  const state = await Promise.race([
    promise.then(() => 'settled', () => 'settled'),
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), milliseconds)),
  ])
  return state === 'pending'
}

async function seedScenario(fixture: Spec001EPostgresFixture) {
  const { prisma, runId } = fixture
  const suffix = runId.replace(/[^a-zA-Z0-9]/g, '').slice(-20)
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

async function cleanup(seed: Seed, fixture: Spec001EPostgresFixture) {
  const { prisma } = fixture
  await prisma.auditLog.deleteMany({ where: { userId: seed.user.id } })
  await prisma.inspection_record.deleteMany({ where: { user_id: seed.user.id } })
  await prisma.equipment_part_installation.deleteMany({ where: { equipment_id: seed.equipment.id } })
  await prisma.parameter_item.deleteMany({ where: { template_id: { in: [seed.template.id, seed.wrongTemplate.id] } } })
  await prisma.parameter_template.deleteMany({ where: { id: { in: [seed.template.id, seed.wrongTemplate.id] } } })
  await prisma.part_revision.deleteMany({ where: { part_id: seed.part.id } })
  await prisma.part.delete({ where: { id: seed.part.id } })
  await prisma.equipment.delete({ where: { id: seed.equipment.id } })
  await prisma.part_category.deleteMany({ where: { id: { in: [seed.category.id, seed.wrongCategory.id] } } })
  await prisma.user.delete({ where: { id: seed.user.id } })
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
      WHERE id = ${seed.installation.id} FOR UPDATE
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
      WHERE id = ${seed.installation.id} FOR UPDATE
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

export async function runSpec001EPostgresScenario(
  fixture: Spec001EPostgresFixture,
  scenario: string,
): Promise<PostgresScenarioResult> {
  const seed = await seedScenario(fixture)
  try {
    if (scenario.includes('installation removal')) return await removalScenario(seed, fixture)
    if (scenario.includes('replacement')) return await replacementScenario(seed, fixture)
    if (scenario.includes('rolls back')) return await rollbackScenario(seed, fixture)
    if (scenario.includes('record_no')) return await recordNumberScenario(seed, fixture)
    assert.fail(`Unknown SPEC-001-E PostgreSQL scenario: ${scenario}`)
  } finally {
    await cleanup(seed, fixture)
  }
}
