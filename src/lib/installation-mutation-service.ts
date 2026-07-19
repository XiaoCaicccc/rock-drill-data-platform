import { type UserRole } from '@prisma/client'
import { logAudit } from './audit'
import { lockEquipmentAndAllInstallations } from './inspection-equipment-lock'
import {
  runSerializableTransactionWithRetry,
  type InteractiveTransactionDatabase,
  type SerializableTransactionRetryOptions,
} from './serializable-transaction'

type InstallationMutationActor = {
  id: string
  role: UserRole
}

type InstallationMutationDependencies = SerializableTransactionRetryOptions & {
  db: InteractiveTransactionDatabase
  audit: typeof logAudit
}

type LockedInstallationState = {
  id: string
  equipment_id: string
  part_revision_id: string
  installed_at: Date
  removed_at: Date | null
  status: string
  created_by: string
  created_at: Date
  remark: string | null
}

export class InstallationMutationError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

function assertOwnership(actor: InstallationMutationActor, createdBy: string | null) {
  if (actor.role === 'admin' || actor.role === 'quality_manager' || createdBy === actor.id) return
  throw new InstallationMutationError(403, '无权操作其他用户创建的资源')
}

async function readLockedInstallations(
  tx: Parameters<typeof lockEquipmentAndAllInstallations>[0],
  ids: string[],
): Promise<LockedInstallationState[]> {
  if (ids.length === 0) return []
  return tx.equipment_part_installation.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      equipment_id: true,
      part_revision_id: true,
      installed_at: true,
      removed_at: true,
      status: true,
      created_by: true,
      created_at: true,
      remark: true,
    },
  })
}

export async function createInstallation(
  input: {
    equipmentId: string
    partRevisionId: string
    installedAt: Date
    remark: string | null
    actor: InstallationMutationActor
    request?: Request
  },
  dependencies: InstallationMutationDependencies,
) {
  return runSerializableTransactionWithRetry(dependencies.db, async (tx) => {
    const lockedState = await lockEquipmentAndAllInstallations(tx, input.equipmentId)
    if (!lockedState.found) throw new InstallationMutationError(404, '设备不存在')

      const equipment = await tx.equipment.findUnique({ where: { id: input.equipmentId } })
      if (!equipment) throw new InstallationMutationError(404, '设备不存在')
      assertOwnership(input.actor, equipment.created_by)

      const lockedInstallations = await readLockedInstallations(
        tx,
        lockedState.installations.map((installation) => installation.id),
      )
      const revisionIds = [...new Set([
        input.partRevisionId,
        ...lockedInstallations.map((installation) => installation.part_revision_id),
      ])]
      const revisions = await tx.part_revision.findMany({
        where: { id: { in: revisionIds } },
        select: { id: true, part_id: true, lifecycle_state: true },
      })
      const revisionById = new Map(revisions.map((revision) => [revision.id, revision]))
      const revision = revisionById.get(input.partRevisionId)
      if (!revision) throw new InstallationMutationError(404, '零件版本不存在')
      if (revision.lifecycle_state !== 'released') {
        throw new InstallationMutationError(409, '仅已发布版本允许装配')
      }

      const replacedRows = lockedInstallations.filter((installation) => (
        installation.equipment_id === input.equipmentId
        && installation.status === 'active'
        && installation.removed_at === null
        && revisionById.get(installation.part_revision_id)?.part_id === revision.part_id
      )).sort((left, right) => left.id.localeCompare(right.id))
      if (replacedRows.some((installation) => input.installedAt < installation.installed_at)) {
        throw new InstallationMutationError(409, '新装配时间不能早于原装配时间')
      }

      for (const installation of replacedRows) {
        const updated = await tx.equipment_part_installation.update({
          where: { id: installation.id },
          data: { status: 'removed', removed_at: input.installedAt },
        })
        await dependencies.audit({
          userId: input.actor.id,
          action: 'UPDATE',
          entityType: 'equipment_part_installation',
          entityId: installation.id,
          before: { status: installation.status, removed_at: installation.removed_at },
          after: { status: updated.status, removed_at: updated.removed_at },
          request: input.request,
        }, tx)
      }

      const installation = await tx.equipment_part_installation.create({
        data: {
          equipment_id: input.equipmentId,
          part_revision_id: revision.id,
          installed_at: input.installedAt,
          status: 'active',
          removed_at: null,
          created_by: input.actor.id,
          remark: input.remark,
        },
      })
      await dependencies.audit({
        userId: input.actor.id,
        action: 'CREATE',
        entityType: 'equipment_part_installation',
        entityId: installation.id,
        after: {
          equipment_id: installation.equipment_id,
          part_revision_id: installation.part_revision_id,
          installed_at: installation.installed_at,
          status: installation.status,
        },
        request: input.request,
      }, tx)
    return installation
  }, dependencies)
}

export async function removeInstallation(
  input: {
    equipmentId: string
    installationId: string
    removedAt: Date
    actor: InstallationMutationActor
    request?: Request
  },
  dependencies: InstallationMutationDependencies,
) {
  return runSerializableTransactionWithRetry(dependencies.db, async (tx) => {
    const lockedState = await lockEquipmentAndAllInstallations(tx, input.equipmentId)
    if (!lockedState.found) throw new InstallationMutationError(404, '设备不存在')

      const equipment = await tx.equipment.findUnique({ where: { id: input.equipmentId } })
      if (!equipment) throw new InstallationMutationError(404, '设备不存在')
      assertOwnership(input.actor, equipment.created_by)

      const lockedInstallations = await readLockedInstallations(
        tx,
        lockedState.installations.map((installation) => installation.id),
      )
      const installation = lockedInstallations.find((candidate) => (
        candidate.id === input.installationId
        && candidate.equipment_id === input.equipmentId
      ))
      if (!installation) throw new InstallationMutationError(404, '装配记录不存在')
      if (installation.status === 'removed') return installation
      if (input.removedAt < installation.installed_at) {
        throw new InstallationMutationError(409, '拆卸时间不能早于装配时间')
      }

      const updated = await tx.equipment_part_installation.update({
        where: { id: installation.id },
        data: { status: 'removed', removed_at: input.removedAt },
      })
      await dependencies.audit({
        userId: input.actor.id,
        action: 'UPDATE',
        entityType: 'equipment_part_installation',
        entityId: updated.id,
        before: { status: installation.status, removed_at: installation.removed_at },
        after: { status: updated.status, removed_at: updated.removed_at },
        request: input.request,
      }, tx)
    return updated
  }, dependencies)
}
