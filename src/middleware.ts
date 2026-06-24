import { auth } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth']
const ADMIN_PATHS = ['/api/users']

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 公开路由放行
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return

  const role = (req.auth?.user as { role?: string })?.role

  // 未登录 → 重定向登录页
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return Response.redirect(loginUrl)
  }

  // 管理员路由 → 非 admin 重定向首页
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && role !== 'admin') {
    const homeUrl = new URL('/', req.url)
    homeUrl.searchParams.set('forbidden', '1')
    return Response.redirect(homeUrl)
  }

  return
}) as any

export { auth }