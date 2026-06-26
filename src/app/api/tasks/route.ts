import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET: 任务列表 ───

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status

  const tasks = await db.task.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ tasks })
}

// ─── POST: 创建任务 ───

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, description, priority, status, assignee, due_date, task_type } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
  }

  const task = await db.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      priority: priority || '中',
      status: status || '待办',
      assignee: assignee || null,
      due_date: due_date ? new Date(due_date) : null,
      task_type: task_type || '常规',
    },
  })

  return NextResponse.json({ task }, { status: 201 })
}

// ─── PUT: 更新任务 ───

const VALID_TRANSITIONS: Record<string, string[]> = {
  '待办': ['进行中', '已关闭'],
  '进行中': ['已完成', '已关闭'],
  '已完成': ['已关闭'],
  '已关闭': [],
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, title, description, priority, status, assignee, due_date, task_type } = body

  if (!id) {
    return NextResponse.json({ error: '缺少任务 ID' }, { status: 400 })
  }

  const existing = await db.task.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }

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
  if (title !== undefined) data.title = title.trim()
  if (description !== undefined) data.description = description || null
  if (priority !== undefined) data.priority = priority
  if (status !== undefined) data.status = status
  if (assignee !== undefined) data.assignee = assignee || null
  if (due_date !== undefined) data.due_date = due_date ? new Date(due_date) : null
  if (task_type !== undefined) data.task_type = task_type

  const updated = await db.task.update({ where: { id }, data })

  return NextResponse.json({ task: updated })
}

// ─── DELETE: 删除任务（仅待办/已关闭可删） ───

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少任务 ID' }, { status: 400 })
  }

  const existing = await db.task.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }

  await db.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}