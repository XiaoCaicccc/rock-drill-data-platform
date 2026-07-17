import { Prisma, type UserRole } from '@prisma/client'
import { logAudit } from './audit'
import { lockEquipmentAndAllInstallations } from './inspection-equipment-lock'
import {
  runSerializableTransactionWithRetry,
  type InteractiveTransactionDatabase,
  type SerializableTransactionRetryOptions,
} from './serializable-transaction'

type EquipmentMutationActor = {
  id: string
  role: UserRole
}

type EquipmentMutationDependencies = SerializableTransactionRetryOptions & {
  db: InteractiveTransactionDatabase
  audit: typeof logAudit
}

export class EquipmentMutationError extends Error {
  constructor(
    readonly status: 403 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

function assertOwnership(actor: EquipmentMutationActor, createdBy: string | null) {
  if (actor.role === 'admin' || actor.role === 'quality_manager' || createdBy === actor.id) return
  throw new EquipmentMutationError(403, '无权操作其他用户创建的资源')
}

function isMachineNumberCollision(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false
  const target = error.meta?.target
  if (Array.isArray(target)) return target.includes('machine_no')
  return typeof target === 'string' && target.includes('machine_no')
}

export async function updateEquipment(
  input: {
    equipmentId: string
    data: Prisma.equipmentUpdateInput
    normalizedMachineNo?: string
    conflictDisplayMachineNo?: string
    actor: EquipmentMutationActor
    request?: Request
  },
  dependencies: EquipmentMutationDependencies,
) {
  try {
    return await runSerializableTransactionWithRetry(dependencies.db, async (tx) => {
      const lockedState = await lockEquipmentAndAllInstallations(tx, input.equipmentId)
      if (!lockedState.found) throw new EquipmentMutationError(404, '设备不存在')

      const current = await tx.equipment.findUnique({ where: { id: input.equipmentId } })
      if (!current) throw new EquipmentMutationError(404, '设备不存在')
      assertOwnership(input.actor, current.created_by)

      if (input.normalizedMachineNo !== undefined) {
        const existing = await tx.equipment.findFirst({
          where: {
            machine_no: input.normalizedMachineNo,
            id: { not: input.equipmentId },
          },
          select: { id: true },
        })
        if (existing) {
          throw new EquipmentMutationError(
            409,
            `机头编号 "${input.conflictDisplayMachineNo ?? input.normalizedMachineNo}" 已被其他设备使用`,
          )
        }
      }

      const updated = await tx.equipment.update({
        where: { id: input.equipmentId },
        data: input.data,
      })
      await dependencies.audit({
        userId: input.actor.id,
        action: 'UPDATE',
        entityType: 'equipment',
        entityId: input.equipmentId,
        before: { machine_no: current.machine_no, status: current.status },
        after: { machine_no: updated.machine_no, status: updated.status },
        request: input.request,
      }, tx)
      return updated
    }, dependencies)
  } catch (error) {
    if (isMachineNumberCollision(error)) {
      throw new EquipmentMutationError(
        409,
        `机头编号 "${input.conflictDisplayMachineNo ?? input.normalizedMachineNo ?? ''}" 已被其他设备使用`,
      )
    }
    throw error
  }
}

export async function deleteEquipment(
  input: {
    equipmentId: string
    actor: EquipmentMutationActor
    request?: Request
  },
  dependencies: EquipmentMutationDependencies,
) {
  return runSerializableTransactionWithRetry(dependencies.db, async (tx) => {
    const lockedState = await lockEquipmentAndAllInstallations(tx, input.equipmentId)
    if (!lockedState.found) throw new EquipmentMutationError(404, '设备不存在')

    const current = await tx.equipment.findUnique({ where: { id: input.equipmentId } })
    if (!current) throw new EquipmentMutationError(404, '设备不存在')
    assertOwnership(input.actor, current.created_by)

    const installationCount = lockedState.installations.length
    if (installationCount > 0) {
      throw new EquipmentMutationError(
        409,
        `该设备下尚有 ${installationCount} 条装配历史，请先移除相关装配记录`,
      )
    }

    await tx.equipment.delete({ where: { id: input.equipmentId } })
    await dependencies.audit({
      userId: input.actor.id,
      action: 'DELETE',
      entityType: 'equipment',
      entityId: input.equipmentId,
      before: { machine_no: current.machine_no },
      request: input.request,
    }, tx)
  }, dependencies)
}
