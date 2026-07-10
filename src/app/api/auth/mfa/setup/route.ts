import { NextResponse } from 'next/server'
import * as OTPAuth from 'otpauth'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/permissions'

/** 基础 MFA 配置接口；前端激活前不会改变 mfa_enabled。 */
export async function POST() {
  const access = await requireRole(['admin'])
  if (access instanceof Response) return access

  const totp = new OTPAuth.TOTP({
    issuer: '凿岩机数据平台',
    label: access.user.id,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  })
  const secret = totp.secret.base32
  await db.user.update({ where: { id: access.user.id }, data: { mfa_secret: secret, mfa_enabled: false } })
  return NextResponse.json({ secret, otpauthUrl: totp.toString() })
}
