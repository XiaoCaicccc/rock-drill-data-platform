import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

// ─── GET: 任务列表（按角色过滤） ───

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const role = (session.user as { role?: string }).role

  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword') || ''
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''

  const where: any = {}
  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ]
  }
  if (status) where.status = status
  if (priority) where.priority = priority
  // 普通用户只能看自己的任务
  if (role !== 'admin' && userId) {
    where.user_id = userId
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ tasks })
}

// ─── POST: 创建任务（自动关联当前用户） ───

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const body = await request.json()
  const { title, description, priority, task_type, due_date, assignee } = body

  if (!title) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
  }

  const task = await db.task.create({
    data: {
      title,
      description: description || null,
      priority: priority || '中',
      task_type: task_type || '常规',
      due_date: due_date ? new Date(due_date) : null,
      assignee: assignee || null,
      user_id: userId,
    },
  })

  return NextResponse.json({ task }, { status: 201 })
}
