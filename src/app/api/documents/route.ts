import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// ─── GET: 文档列表 ───

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || ''
  const archived = searchParams.get('archived')
  const keyword = searchParams.get('keyword') || ''

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (archived !== null && archived !== '') {
    where.archived = archived === 'true'
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
    ]
  }

  const documents = await db.document.findMany({
    where,
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ documents })
}

// ─── POST: 上传文档 ───

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const title = formData.get('title') as string
  const category = formData.get('category') as string
  const relatedReportId = formData.get('related_report_id') as string | null
  const file = formData.get('file') as File | null

  if (!title?.trim() || !category?.trim()) {
    return NextResponse.json({ error: '标题和类别不能为空' }, { status: 400 })
  }

  let filePath: string | null = null
  if (file && file.size > 0) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadsDir, { recursive: true })

    const ext = path.extname(file.name) || '.bin'
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const fullDir = path.join(uploadsDir, uniqueName)

    await writeFile(fullDir, buffer)
    filePath = `/uploads/${uniqueName}`
  }

  const document = await db.document.create({
    data: {
      title: title.trim(),
      category: category.trim(),
      file_path: filePath,
      related_report_id: relatedReportId || null,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}

// ─── PUT: 更新文档（归档/取消归档） ───

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, title, category, archived, related_report_id } = body

  if (!id) {
    return NextResponse.json({ error: '缺少文档 ID' }, { status: 400 })
  }

  const existing = await db.document.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title.trim()
  if (category !== undefined) data.category = category
  if (archived !== undefined) data.archived = archived
  if (related_report_id !== undefined) data.related_report_id = related_report_id || null

  const updated = await db.document.update({ where: { id }, data })

  return NextResponse.json({ document: updated })
}

// ─── DELETE: 删除文档 ───

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: '缺少文档 ID' }, { status: 400 })
  }

  const existing = await db.document.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  }

  await db.document.delete({ where: { id } })
  return NextResponse.json({ success: true })
}