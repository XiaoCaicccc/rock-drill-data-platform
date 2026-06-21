import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/tasks - 获取任务列表
export async function GET() {
  try {
    const tasks = await db.task.findMany({
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    })
    return NextResponse.json({ data: tasks })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取任务列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/tasks - 创建任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, priority, assignee, dueDate } = body

    const task = await db.task.create({
      data: {
        title,
        description: description || '',
        priority: priority || '中',
        assignee: assignee || '',
        dueDate: dueDate ? new Date(dueDate) : null,
        status: '待办',
      }
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建任务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/tasks - 更新任务
export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json()
    if (!id) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
    }

    const task = await db.task.update({
      where: { id },
      data: body,
    })

    return NextResponse.json({ data: task })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新任务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/tasks?id=xxx - 删除任务
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 })
    }

    await db.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除任务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}