import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { isRateLimited } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Railway 反向代理下必须信任 Host；本地和生产均从环境变量取回调地址。
  baseUrl: process.env.NEXTAUTH_URL,
  trustHost: true,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const forwarded = request?.headers?.get('x-forwarded-for')
        const ip = forwarded?.split(',')[0]?.trim() ?? request?.headers?.get('x-real-ip') ?? 'unknown'
        if (isRateLimited(`login:${ip}`)) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user) return null
        if (!user.active) return null

        if (user.locked_until && user.locked_until > new Date()) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        )

        if (!isValid) {
          const failedLoginAttempts = user.failed_login_attempts + 1
          await db.user.update({
            where: { id: user.id },
            data: {
              failed_login_attempts: failedLoginAttempts,
              locked_until: failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
            },
          })
          return null
        }

        await db.user.update({
          where: { id: user.id },
          data: { failed_login_attempts: 0, locked_until: null },
        })
        await logAudit({ userId: user.id, action: 'LOGIN', entityType: 'user', entityId: user.id })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organization_id: user.organization_id,
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.role = (user as { role?: string }).role
        token.organizationId = (user as { organization_id?: string | null }).organization_id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.userId as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { organization_id?: string | null }).organization_id = token.organizationId as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
