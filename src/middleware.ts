import { auth } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico']
const ADMIN_PATHS = ['/api/users']

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 公开路由放行（包括静态资源、auth 回调、登录页）
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return

  const role = (req.auth?.user as { role?: string })?.role

  // 未登录 → 重定向登录页
  if (!req.auth) {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: '未登录' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return Response.redirect(loginUrl)
  }

  // 管理员路由 → 非 admin 重定向首页
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return Response.json({ error: '需要管理员权限' }, { status: 403 })
    }
    const homeUrl = new URL('/', req.url)
    homeUrl.searchParams.set('forbidden', '1')
    return Response.redirect(homeUrl)
  }

  return
}) as any

export { auth }
