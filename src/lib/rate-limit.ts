/**
 * 进程内限流器。单实例 Railway 服务可直接使用；横向扩容时应替换为 Redis/Upstash。
 */
const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 20

export function isRateLimited(key: string) {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > MAX_ATTEMPTS
}
