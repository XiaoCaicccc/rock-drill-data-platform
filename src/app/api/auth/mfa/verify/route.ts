import { NextRequest, NextResponse } from 'next/server'
import * as OTPAuth from 'otpauth'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  const access = await requireRole(['admin'])
  if (access instanceof Response) return access
  const { token } = await request.json()
  const user = await db.user.findUnique({ where: { id: access.user.id }, select: { mfa_secret: true } })
  if (!user?.mfa_secret || typeof token !== 'string') return NextResponse.json({ error: 'MFA 尚未初始化' }, { status: 400 })
  const totp = new OTPAuth.TOTP({ issuer: '凿岩机数据平台', label: access.user.id, secret: user.mfa_secret })
  if (totp.validate({ token, window: 1 }) === null) return NextResponse.json({ error: '验证码无效' }, { status: 400 })
  await db.user.update({ where: { id: access.user.id }, data: { mfa_enabled: true } })
  return NextResponse.json({ success: true })
}
