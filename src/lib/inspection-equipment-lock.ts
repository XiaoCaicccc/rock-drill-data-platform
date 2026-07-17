import { Prisma } from '@prisma/client'

export type LockedEquipment = { id: string }

export type LockedEquipmentInstallation = {
  id: string
  equipment_id: string
  part_revision_id: string
  installed_at: Date
  removed_at: Date | null
}

export type EquipmentInstallationLockResult =
  | { found: false; installations: [] }
  | {
      found: true
      equipment: LockedEquipment
      installations: LockedEquipmentInstallation[]
    }

async function lockEquipment(
  tx: Prisma.TransactionClient,
  equipmentId: string,
) {
  const equipmentRows = await tx.$queryRaw<LockedEquipment[]>(Prisma.sql`
    SELECT id
    FROM "equipment"
    WHERE id = ${equipmentId}
    FOR UPDATE
  `)
  return equipmentRows[0] ?? null
}

/** Locks equipment first, then every installation row for that equipment. */
export async function lockEquipmentAndAllInstallations(
  tx: Prisma.TransactionClient,
  equipmentId: string,
): Promise<EquipmentInstallationLockResult> {
  const equipment = await lockEquipment(tx, equipmentId)
  if (!equipment) return { found: false, installations: [] }

  const installations = await tx.$queryRaw<LockedEquipmentInstallation[]>(Prisma.sql`
    SELECT id, equipment_id, part_revision_id, installed_at, removed_at
    FROM "equipment_part_installation"
    WHERE equipment_id = ${equipmentId}
    ORDER BY id
    FOR UPDATE
  `)

  return { found: true, equipment, installations }
}

/** Locks equipment first, then installations for a non-empty set of part revisions. */
export async function lockEquipmentAndInstallationsForPartRevisions(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  partRevisionIds: readonly [string, ...string[]],
): Promise<EquipmentInstallationLockResult> {
  if (partRevisionIds.length === 0) {
    throw new TypeError('partRevisionIds must contain at least one id')
  }

  const equipment = await lockEquipment(tx, equipmentId)
  if (!equipment) return { found: false, installations: [] }

  const installations = await tx.$queryRaw<LockedEquipmentInstallation[]>(Prisma.sql`
    SELECT id, equipment_id, part_revision_id, installed_at, removed_at
    FROM "equipment_part_installation"
    WHERE equipment_id = ${equipmentId}
      AND part_revision_id IN (${Prisma.join(
        partRevisionIds.map((revisionId) => Prisma.sql`${revisionId}::uuid`),
      )})
    ORDER BY id
    FOR UPDATE
  `)

  return { found: true, equipment, installations }
}
