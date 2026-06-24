import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '@/lib/check-admin'
import { db } from '@/lib/db'

// ─── GET: 用户列表 ───

export async function GET() {
  const denied = await requireAdmin()
  if (denied) return denied

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      created_at: true,
    },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json({ users })
}

// ─── POST: 创建用户 ───

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const { email, password, name, role } = body

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }
  if (!['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: '角色无效' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: '邮箱已存在' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await db.user.create({
    data: { email, password: hashedPassword, name, role, active: true },
    select: { id: true, email: true, name: true, role: true, active: true, created_at: true },
  })

  return NextResponse.json({ user }, { status: 201 })
}

// ─── PUT: 编辑用户 ───

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await request.json()
  const { id, name, role, active } = body

  if (!id) {
    return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 })
  }
  if (role && !['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: '角色无效' }, { status: 400 })
  }

  const user = await db.user.update({
    where: { id },
    data: { ...(name !== undefined && { name }), ...(role !== undefined && { role }), ...(active !== undefined && { active }) },
    select: { id: true, email: true, name: true, role: true, active: true, created_at: true },
  })

  return NextResponse.json({ user })
}