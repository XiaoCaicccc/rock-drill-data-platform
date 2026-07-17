import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

export type Spec001EPostgresFixture = {
  prisma: PrismaClient
  runId: string
  close: () => Promise<void>
}

/**
 * Creates only the connection lifecycle for SPEC-001-E PostgreSQL tests.
 * Scenario seeding, writer barriers, and cleanup are intentionally left for the
 * implementation phase because their exact records depend on the service API.
 */
export async function openSpec001EPostgresFixture(): Promise<Spec001EPostgresFixture> {
  const databaseUrl = process.env.DATABASE_URL
  assert.ok(databaseUrl, 'DATABASE_URL is required for SPEC-001-E PostgreSQL tests')
  assert.match(databaseUrl, /^postgres(?:ql)?:\/\//, 'SPEC-001-E tests require PostgreSQL')

  const prisma = new PrismaClient()
  await prisma.$connect()

  return {
    prisma,
    runId: `spec001e-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    close: () => prisma.$disconnect(),
  }
}
