import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── GET: 分析报告列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const role = (session.user as { role?: string }).role

  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || ''
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { report_no: { contains: keyword, mode: 'insensitive' } },
    ]
  }
  if (type) where.type = type
  if (status) where.status = status
  // 普通用户只能看自己创建的报告
  if (role !== 'admin' && userId) {
    where.user_id = userId
  }

  const reports = await db.analysis_report.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ reports })
}

// ─── POST: 创建报告（自动关联当前用户） ───

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const body = await request.json()
  const { title, type, period, summary, conclusion, author } = body

  if (!title || !type) {
    return NextResponse.json({ error: '标题和类型不能为空' }, { status: 400 })
  }

  const report = await db.analysis_report.create({
    data: {
      report_no: `BG-${Date.now()}`,
      title,
      type,
      period: period || null,
      summary: summary || null,
      conclusion: conclusion || null,
      author: author || '',
      user_id: userId,
    },
  })

  return NextResponse.json({ report }, { status: 201 })
}

// ─── PUT: 更新报告内容 / 状态流转 ───

const VALID_TRANSITIONS: Record<string, string[]> = {
  '草稿': ['已发布'],
  '已发布': ['已归档'],
  '已归档': [],
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json()
  const { id, title, type, period, summary, conclusion, author, status } = body

  if (!id) {
    return NextResponse.json({ error: '缺少报告 ID' }, { status: 400 })
  }

  const existing = await db.analysis_report.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 })
  }

  // 状态流转校验
  if (status && status !== existing.status) {
    const allowed = VALID_TRANSITIONS[existing.status] ?? []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `不允许从"${existing.status}"转为"${status}"，合法目标：${allowed.join('、') || '无'}` },
        { status: 400 },
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (type !== undefined) data.type = type
  if (period !== undefined) data.period = period || null
  if (summary !== undefined) data.summary = summary || null
  if (conclusion !== undefined) data.conclusion = conclusion || null
  if (author !== undefined) data.author = author
  if (status !== undefined) data.status = status

  const updated = await db.analysis_report.update({
    where: { id },
    data,
  })

  return NextResponse.json({ report: updated })
}

// ─── DELETE: 删除报告（仅草稿可删） ───

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少报告 ID' }, { status: 400 })
  }

  const existing = await db.analysis_report.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '报告不存在' }, { status: 404 })
  }
  if (existing.status !== '草稿') {
    return NextResponse.json(
      { error: `仅草稿状态可删除，当前状态为"${existing.status}"` },
      { status: 409 },
    )
  }

  await db.analysis_report.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
