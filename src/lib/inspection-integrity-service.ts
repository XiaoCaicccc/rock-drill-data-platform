import { Prisma, type PrismaClient } from '@prisma/client'
import { logAudit } from './audit'
import { InspectionDomainError } from './inspection-errors'
import {
  parseInspectionTimestamp,
  type BatchInspectionItem,
  type BatchInspectionRequest,
  type ParsedInspectionTimestamp,
} from './inspection-integrity'

type TransactionClient = Prisma.TransactionClient

type InspectionServiceDatabase = Pick<PrismaClient, '$transaction'>

export type InspectionIntegrityServiceDependencies = {
  db: InspectionServiceDatabase
  audit: typeof logAudit
  sleep: (milliseconds: number) => Promise<void>
  random: () => number
  now: () => Date
}

export type CreateInspectionBatchContext = {
  userId: string
  request?: Request
}

type LockedInstallation = {
  id: string
  equipment_id: string
  part_revision_id: string
  installed_at: Date
  removed_at: Date | null
}

type QualificationBounds = {
  standard_min: number | null
  standard_max: number | null
  optimal_min: number | null
  optimal_max: number | null
}

export type QualificationResult = {
  is_qualified: boolean | null
  is_optimal: boolean | null
}

const defaultDependencies: InspectionIntegrityServiceDependencies = {
  db: undefined as unknown as InspectionServiceDatabase,
  audit: logAudit,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random: Math.random,
  now: () => new Date(),
}

async function loadDefaultDatabase() {
  const { db } = await import('./db')
  return db
}

export function calculateInspectionQualification(
  value: number | null,
  bounds: QualificationBounds,
): QualificationResult {
  const isQualified = value == null || bounds.standard_min == null || bounds.standard_max == null
    ? null
    : value >= bounds.standard_min && value <= bounds.standard_max
  const isOptimal = value == null || bounds.optimal_min == null || bounds.optimal_max == null
    ? null
    : value >= bounds.optimal_min && value <= bounds.optimal_max
  return { is_qualified: isQualified, is_optimal: isOptimal }
}

function assertNoDuplicateMeasurements(items: BatchInspectionItem[]) {
  const seen = new Set<string>()
  for (const item of items) {
    const key = `${item.part_revision_id.toLowerCase()}\u0000${item.param_item_id.trim()}`
    if (seen.has(key)) {
      throw new InspectionDomainError(
        'DUPLICATE_MEASUREMENT',
        '同一检测记录内存在重复测量组合',
      )
    }
    seen.add(key)
  }
}

function overallResult(items: Array<{ is_qualified: boolean | null }>) {
  const checked = items.filter((item) => item.is_qualified !== null)
  if (checked.length === 0) return '待检'
  return checked.every((item) => item.is_qualified) ? '合格' : '不合格'
}

function recordPrefix(inspectionDate: Date) {
  return `JC-${inspectionDate.toISOString().slice(0, 10).replace(/-/g, '')}-`
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown }
    cause?: unknown
  }
  if (typeof candidate.code === 'string') return candidate.code
  if (typeof candidate.meta?.code === 'string') return candidate.meta.code
  return errorCode(candidate.cause)
}

function isRecordNumberCollision(error: unknown) {
  if (errorCode(error) !== 'P2002' || !error || typeof error !== 'object') return false
  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (Array.isArray(target)) return target.includes('record_no')
  return typeof target === 'string' && target.includes('record_no')
}

function isRetryableTransactionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    code?: unknown
    meta?: { code?: unknown }
    cause?: unknown
  }
  const codes = [candidate.code, candidate.meta?.code]
  return codes.some((code) => code === '40001' || code === '40P01' || code === 'P2034')
    || isRecordNumberCollision(error)
    || isRetryableTransactionError(candidate.cause)
}

function retryDelay(attempt: number, random: () => number) {
  const [minimum, maximum] = attempt === 1 ? [25, 50] : [75, 150]
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}

async function lockEquipment(tx: TransactionClient, equipmentId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id
    FROM "equipment"
    WHERE id = ${equipmentId}
    FOR UPDATE
  `)
  if (rows.length === 0) {
    throw new InspectionDomainError('RESOURCE_NOT_FOUND', '设备不存在或不可用')
  }
}

async function lockInstallations(
  tx: TransactionClient,
  equipmentId: string,
  revisionIds: string[],
) {
  return tx.$queryRaw<LockedInstallation[]>(Prisma.sql`
    SELECT id, equipment_id, part_revision_id, installed_at, removed_at
    FROM "equipment_part_installation"
    WHERE equipment_id = ${equipmentId}
      AND part_revision_id IN (${Prisma.join(revisionIds)})
    ORDER BY id
    FOR UPDATE
  `)
}

async function executeTransaction(
  input: BatchInspectionRequest,
  context: CreateInspectionBatchContext,
  dependencies: InspectionIntegrityServiceDependencies,
  authoritativeNow: Date,
  parsedTimestamp: ParsedInspectionTimestamp,
) {
  const revisionIds = [...new Set(input.items.map((item) => item.part_revision_id))]
  const parameterIds = [...new Set(input.items.map((item) => item.param_item_id))]

  return dependencies.db.$transaction(async (tx) => {
    await lockEquipment(tx, input.record.equipment_id)
    const installations = await lockInstallations(tx, input.record.equipment_id, revisionIds)
    const transactionTimestamp = parseInspectionTimestamp(input.record.inspection_date, {
      now: authoritativeNow,
    })
    if (transactionTimestamp.date.getTime() !== parsedTimestamp.date.getTime()) {
      throw new InspectionDomainError('INVALID_REQUEST', '检测时间在事务执行前发生变化')
    }
    const inspectionDate = transactionTimestamp.date

    const [user, revisions, parameters] = await Promise.all([
      tx.user.findUnique({
        where: { id: context.userId },
        select: { id: true, name: true, active: true },
      }),
      tx.part_revision.findMany({
        where: { id: { in: revisionIds } },
        select: {
          id: true,
          part_id: true,
          lifecycle_state: true,
          part: { select: { category_id: true } },
        },
      }),
      tx.parameter_item.findMany({
        where: { id: { in: parameterIds } },
        select: {
          id: true,
          standard_min: true,
          standard_max: true,
          optimal_min: true,
          optimal_max: true,
          template: { select: { category_id: true } },
        },
      }),
    ])

    if (!user?.active) {
      throw new InspectionDomainError('UNAUTHENTICATED', '当前用户不存在或已停用')
    }

    const revisionMap = new Map(revisions.map((revision) => [revision.id, revision]))
    const parameterMap = new Map(parameters.map((parameter) => [parameter.id, parameter]))

    const processedItems = input.items.map((item) => {
      const revision = revisionMap.get(item.part_revision_id)
      if (!revision) {
        throw new InspectionDomainError('RESOURCE_NOT_FOUND', '零件版本不存在或不可用')
      }
      if (revision.lifecycle_state !== 'released') {
        throw new InspectionDomainError('REVISION_NOT_RELEASED', '零件版本尚未发布')
      }

      const eligibleInstallation = installations.some((installation) => (
        installation.equipment_id === input.record.equipment_id
        && installation.part_revision_id === revision.id
        && installation.installed_at.getTime() <= inspectionDate.getTime()
        && (installation.removed_at === null
          || installation.removed_at.getTime() > inspectionDate.getTime())
      ))
      if (!eligibleInstallation) {
        throw new InspectionDomainError(
          'INSTALLATION_NOT_ELIGIBLE',
          '零件版本在检测时点未有效装配于目标设备',
        )
      }

      const parameter = parameterMap.get(item.param_item_id)
      if (!parameter) {
        throw new InspectionDomainError('RESOURCE_NOT_FOUND', '参数项不存在或不可用')
      }
      if (parameter.template.category_id !== revision.part.category_id) {
        throw new InspectionDomainError(
          'PARAMETER_CATEGORY_MISMATCH',
          '参数模板类别与零件类别不匹配',
        )
      }

      return {
        part_id: revision.part_id,
        part_revision_id: revision.id,
        param_item_id: parameter.id,
        value_number: item.value_number,
        value_text: item.value_text,
        ...calculateInspectionQualification(item.value_number, parameter),
      }
    })

    const prefix = recordPrefix(inspectionDate)
    const count = await tx.inspection_record.count({
      where: { record_no: { startsWith: prefix } },
    })
    const recordNo = `${prefix}${String(count + 1).padStart(3, '0')}`
    const record = await tx.inspection_record.create({
      data: {
        record_no: recordNo,
        equipment_id: input.record.equipment_id,
        inspector: user.name,
        batch_no: input.record.batch_no ?? null,
        inspection_date: inspectionDate,
        overall_result: overallResult(processedItems),
        remark: input.record.remark ?? null,
        user_id: user.id,
        data_items: { createMany: { data: processedItems } },
      },
      include: { data_items: true },
    })

    await dependencies.audit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'inspection_record',
      entityId: record.id,
      after: { record_no: record.record_no, item_count: processedItems.length },
      request: context.request,
    }, tx)

    return record
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function createInspectionBatch(
  input: BatchInspectionRequest,
  context: CreateInspectionBatchContext,
  overrides: Partial<InspectionIntegrityServiceDependencies> = {},
) {
  assertNoDuplicateMeasurements(input.items)
  const dependencies = {
    ...defaultDependencies,
    ...overrides,
    db: overrides.db ?? await loadDefaultDatabase(),
  }
  const authoritativeNow = dependencies.now()
  const parsedTimestamp = parseInspectionTimestamp(input.record.inspection_date, {
    now: authoritativeNow,
  })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await executeTransaction(
        input,
        context,
        dependencies,
        authoritativeNow,
        parsedTimestamp,
      )
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error
      if (attempt === 2) {
        throw new InspectionDomainError(
          'CONCURRENT_MODIFICATION',
          '并发修改冲突，请重试',
        )
      }
      await dependencies.sleep(retryDelay(attempt + 1, dependencies.random))
    }
  }

  throw new InspectionDomainError('CONCURRENT_MODIFICATION', '并发修改冲突，请重试')
}
