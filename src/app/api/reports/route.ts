import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports - 获取报告列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (status) where.status = status

    const reports = await db.analysisReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: reports })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取报告列表失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/reports - 创建报告
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, type, period, summary, conclusion, author } = body

    // 生成报告编号
    const typeMap: Record<string, string> = {
      '月度分析': 'YD',
      '季度分析': 'JD',
      '专项分析': 'ZX',
      '全生命周期': 'SQ',
    }
    const prefix = typeMap[type] || 'QT'
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

    const lastReport = await db.analysisReport.findFirst({
      where: { reportNo: { contains: dateStr } },
      orderBy: { createdAt: 'desc' },
      select: { reportNo: true },
    })

    let nextNum = 1
    if (lastReport?.reportNo) {
      const match = lastReport.reportNo.match(/(\d{3})$/)
      if (match) nextNum = parseInt(match[1]) + 1
    }

    const report = await db.analysisReport.create({
      data: {
        title,
        reportNo: `BG-${dateStr}-${prefix}${String(nextNum).padStart(3, '0')}`,
        type: type || '专项分析',
        period: period || '',
        summary: summary || '',
        conclusion: conclusion || '',
        author: author || '系统',
        status: '草稿',
      }
    })

    return NextResponse.json({ data: report }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '创建报告失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/reports - 更新报告
export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json()
    if (!id) {
      return NextResponse.json({ error: '缺少报告ID' }, { status: 400 })
    }

    const report = await db.analysisReport.update({
      where: { id },
      data: body,
    })

    return NextResponse.json({ data: report })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '更新报告失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/reports?id=xxx - 删除报告
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: '缺少报告ID' }, { status: 400 })
    }

    await db.analysisReport.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除报告失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}