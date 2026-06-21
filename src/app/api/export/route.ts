import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/export?format=csv&type=inspections - 数据导出
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const type = searchParams.get('type') || 'inspections'

    if (type === 'inspections') {
      const records = await db.inspectionRecord.findMany({
        include: { part: { include: { category: true } } },
        orderBy: { inspectionDate: 'desc' },
      })

      if (format === 'csv') {
        const headers = ['检测编号', '零部件编号', '零部件名称', '类别', '批次号', '检测员', '检测日期', '硬度(HRC)', '尺寸A(mm)', '尺寸B(mm)', '重量(g)', '表面质量', '内部缺陷', '检测结果', '备注']
        const rows = records.map(r => [
          r.recordNo,
          r.part.code,
          r.part.name,
          r.part.category.name,
          r.batchNo || '',
          r.inspector,
          r.inspectionDate.toISOString().split('T')[0],
          r.hardness?.toFixed(1) || '',
          r.dimensionA?.toFixed(2) || '',
          r.dimensionB?.toFixed(2) || '',
          r.weight?.toFixed(1) || '',
          r.surfaceQuality || '',
          r.innerDefect || '',
          r.result,
          r.remark || '',
        ])

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        // Add BOM for Chinese character support
        const bom = '\uFEFF'
        return new NextResponse(bom + csvContent, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename=inspection_records.csv',
          },
        })
      }
    }

    return NextResponse.json({ error: '不支持的导出类型' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导出失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}