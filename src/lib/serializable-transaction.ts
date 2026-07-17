import { Prisma } from '@prisma/client'

export type InteractiveTransactionDatabase = {
  $transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>
}

export type SerializableTransactionRetryOptions = {
  sleep?: (milliseconds: number) => Promise<void>
  random?: () => number
  isRetryable?: (error: unknown) => boolean
}

export class SerializableTransactionRetryExhaustedError extends Error {
  constructor(readonly lastError: unknown) {
    super('Serializable transaction retry limit exhausted')
  }
}

export function isRetryablePostgresTransactionError(error: unknown): boolean {
  const visited = new Set<object>()
  let current = error
  while (current && typeof current === 'object') {
    if (visited.has(current)) return false
    visited.add(current)
    const candidate = current as { code?: unknown; meta?: { code?: unknown }; cause?: unknown }
    const codes = [candidate.code, candidate.meta?.code]
    if (codes.some((code) => code === '40001' || code === '40P01' || code === 'P2034')) {
      return true
    }
    current = candidate.cause
  }
  return false
}

function retryDelay(attempt: number, random: () => number) {
  const [minimum, maximum] = attempt === 1 ? [25, 50] : [75, 150]
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}

export async function runSerializableTransactionWithRetry<T>(
  db: InteractiveTransactionDatabase,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: SerializableTransactionRetryOptions = {},
) {
  const sleep = options.sleep ?? ((milliseconds: number) => (
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  ))
  const random = options.random ?? Math.random
  const isRetryable = options.isRetryable ?? isRetryablePostgresTransactionError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isRetryable(error)) throw error
      if (attempt === 2) throw new SerializableTransactionRetryExhaustedError(error)
      await sleep(retryDelay(attempt + 1, random))
    }
  }

  throw new SerializableTransactionRetryExhaustedError(undefined)
}
