import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── GET: 考勤记录（按月份） ───

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10)
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString(), 10)

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  const records = await db.attendance_record.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    orderBy: [{ member_name: 'asc' }, { date: 'asc' }],
  })

  const memberNames = [...new Set(records.map(r => r.member_name))]
  const daysInMonth = endDate.getDate()

  const stats = memberNames.map(name => {
    const memberRecords = records.filter(r => r.member_name === name)
    return {
      name,
      attend: memberRecords.filter(r => r.status === '出勤').length,
      leave: memberRecords.filter(r => r.status === '请假').length,
      late: memberRecords.filter(r => r.status === '迟到').length,
      trip: memberRecords.filter(r => r.status === '出差').length,
    }
  })

  return NextResponse.json({
    records,
    memberNames,
    daysInMonth,
    stats,
    year,
    month,
  })
}

// ─── POST: 批量创建/更新考勤记录 ───

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { records } = body as { records: { date: string; member_name: string; status: string; remark?: string }[] }

  if (!records || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: '考勤记录不能为空' }, { status: 400 })
  }

  const results = []
  for (const rec of records) {
    if (!rec.date || !rec.member_name || !rec.status) continue

    const dateObj = new Date(rec.date)
    const existing = await db.attendance_record.findFirst({
      where: {
        date: dateObj,
        member_name: rec.member_name,
      },
    })

    if (existing) {
      const updated = await db.attendance_record.update({
        where: { id: existing.id },
        data: {
          status: rec.status,
          remark: rec.remark || null,
        },
      })
      results.push(updated)
    } else {
      const created = await db.attendance_record.create({
        data: {
          date: dateObj,
          member_name: rec.member_name,
          status: rec.status,
          remark: rec.remark || null,
        },
      })
      results.push(created)
    }
  }

  return NextResponse.json({ records: results }, { status: 201 })
}

// ─── PUT: 更新单条考勤 ───

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, status, remark } = body

  if (!id) {
    return NextResponse.json({ error: '缺少考勤记录 ID' }, { status: 400 })
  }

  const existing = await db.attendance_record.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: '考勤记录不存在' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (status !== undefined) data.status = status
  if (remark !== undefined) data.remark = remark || null

  const updated = await db.attendance_record.update({ where: { id }, data })

  return NextResponse.json({ record: updated })
}