import type { UserRole } from '@prisma/client'

export type AuthoritativeUser = {
  id: string
  role: UserRole
  organization_id: string | null
}

type CurrentUserRecord = AuthoritativeUser & { active: boolean }
type CurrentUserLookup = (userId: string) => Promise<CurrentUserRecord | null>

/** Resolve authorization identity from the current database record, never JWT claims. */
export async function resolveAuthoritativeUser(
  sessionUserId: string | undefined,
  lookupCurrentUser: CurrentUserLookup,
): Promise<AuthoritativeUser | null> {
  if (!sessionUserId) return null
  const currentUser = await lookupCurrentUser(sessionUserId)
  if (!currentUser?.active) return null
  return {
    id: currentUser.id,
    role: currentUser.role,
    organization_id: currentUser.organization_id,
  }
}
