import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is not set')
  }
  const authToken = process.env.TURSO_AUTH_TOKEN
  const adapter = new PrismaLibSQL({ url, authToken })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV !== 'production' ? ['query'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db