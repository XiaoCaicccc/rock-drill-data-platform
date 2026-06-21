import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // 创建零部件类别
    const categories = await Promise.all([
      db.partCategory.create({ data: { name: '钻头', code: 'ZT' } }),
      db.partCategory.create({ data: { name: '活塞', code: 'HS' } }),
      db.partCategory.create({ data: { name: '缸体', code: 'GT' } }),
      db.partCategory.create({ data: { name: '钎尾', code: 'YW' } }),
      db.partCategory.create({ data: { name: '阀体', code: 'FT' } }),
      db.partCategory.create({ data: { name: '螺旋杆', code: 'LG' } }),
    ])

    const suppliers = ['三一重工供应商', '中联重科供应商', '徐工供应商', '山推供应商', '自有生产']

    // 创建零部件
    const partsData = [
      { code: 'ZT-001', name: '十字钻头', categoryId: categories[0].id, specification: 'φ48mm', material: '42CrMo', supplier: suppliers[0] },
      { code: 'ZT-002', name: '球齿钻头', categoryId: categories[0].id, specification: 'φ64mm', material: '40CrNiMo', supplier: suppliers[1] },
      { code: 'ZT-003', name: '一字钻头', categoryId: categories[0].id, specification: 'φ38mm', material: '42CrMo', supplier: suppliers[4] },
      { code: 'HS-001', name: '大活塞', categoryId: categories[1].id, specification: 'φ120×280mm', material: '20CrMnTi', supplier: suppliers[2] },
      { code: 'HS-002', name: '小活塞', categoryId: categories[1].id, specification: 'φ80×200mm', material: '20CrMnTi', supplier: suppliers[2] },
      { code: 'GT-001', name: '前缸体', categoryId: categories[2].id, specification: 'φ150×400mm', material: 'ZG270-500', supplier: suppliers[4] },
      { code: 'GT-002', name: '后缸体', categoryId: categories[2].id, specification: 'φ130×350mm', material: 'ZG270-500', supplier: suppliers[4] },
      { code: 'YW-001', name: '六角钎尾', categoryId: categories[3].id, specification: 'H22×108mm', material: '95CrMo', supplier: suppliers[3] },
      { code: 'YW-002', name: '圆形钎尾', categoryId: categories[3].id, specification: 'φ32×400mm', material: '95CrMo', supplier: suppliers[3] },
      { code: 'FT-001', name: '配气阀体', categoryId: categories[4].id, specification: 'φ60×80mm', material: '40Cr', supplier: suppliers[0] },
      { code: 'LG-001', name: '前螺旋杆', categoryId: categories[5].id, specification: 'φ50×1500mm', material: '42CrMo', supplier: suppliers[1] },
      { code: 'LG-002', name: '后螺旋杆', categoryId: categories[5].id, specification: 'φ45×1200mm', material: '42CrMo', supplier: suppliers[1] },
    ]

    const parts = await Promise.all(
      partsData.map(p => db.part.create({ data: p }))
    )

    // 创建检测记录（模拟3个月的数据）
    const inspectors = ['张伟', '李明', '王芳', '刘强', '陈静']
    const results = ['合格', '合格', '合格', '合格', '合格', '合格', '合格', '不合格', '待复检']
    const surfaceQuality = ['良好', '良好', '良好', '一般', '不合格']
    const innerDefects = ['无', '无', '无', '无', '轻微', '无', '无']

    const inspections: Array<{
      recordNo: string
      partId: string
      batchNo: string
      inspector: string
      inspectionDate: Date
      hardness: number
      dimensionA: number
      dimensionB: number
      weight: number
      surfaceQuality: string
      innerDefect: string
      result: string
    }> = []

    let recordIndex = 1
    for (let month = 4; month <= 6; month++) {
      for (let day = 1; day <= 28; day += 2) {
        // 每天随机检测2-5个零件
        const dailyCount = 2 + Math.floor(Math.random() * 4)
        for (let i = 0; i < dailyCount; i++) {
          const part = parts[Math.floor(Math.random() * parts.length)]
          const monthStr = String(month).padStart(2, '0')
          const dayStr = String(day).padStart(2, '0')
          inspections.push({
            recordNo: `JY-2025-${String(recordIndex).padStart(4, '0')}`,
            partId: part.id,
            batchNo: `PC-2025${monthStr}-${String(Math.floor(day / 7) + 1).padStart(2, '0')}`,
            inspector: inspectors[Math.floor(Math.random() * inspectors.length)],
            inspectionDate: new Date(2025, month - 1, day),
            hardness: 38 + Math.random() * 20,
            dimensionA: 30 + Math.random() * 100,
            dimensionB: 50 + Math.random() * 300,
            weight: 200 + Math.random() * 5000,
            surfaceQuality: surfaceQuality[Math.floor(Math.random() * surfaceQuality.length)],
            innerDefect: innerDefects[Math.floor(Math.random() * innerDefects.length)],
            result: results[Math.floor(Math.random() * results.length)],
          })
          recordIndex++
        }
      }
    }

    // 批量写入检测记录
    for (let i = 0; i < inspections.length; i += 50) {
      const batch = inspections.slice(i, i + 50)
      await Promise.all(
        batch.map(ins => db.inspectionRecord.create({ data: ins }))
      )
    }

    // 创建分析报告
    await Promise.all([
      db.analysisReport.create({
        data: {
          title: '2025年4月凿岩机零部件质量分析月报',
          reportNo: 'BG-2025-04-001',
          type: '月度分析',
          period: '2025年4月',
          status: '已发布',
          summary: '4月份共完成检测198件，合格率92.4%，较上月提升1.2个百分点。钻头类零部件合格率最高达96.8%，缸体类合格率偏低为87.3%。',
          conclusion: '建议加强缸体供应商管理，提高表面处理工艺标准。钻头类继续保持现有品质管控水平。',
          author: '张伟',
        }
      }),
      db.analysisReport.create({
        data: {
          title: '2025年5月凿岩机零部件质量分析月报',
          reportNo: 'BG-2025-05-001',
          type: '月度分析',
          period: '2025年5月',
          status: '已发布',
          summary: '5月份共完成检测215件，合格率93.1%。活塞类零部件硬度分布趋于稳定，缸体表面质量问题较上月有所改善。',
          conclusion: '5月质量指标持续向好，建议持续推进供应商质量改善计划。',
          author: '张伟',
        }
      }),
      db.analysisReport.create({
        data: {
          title: '2025年Q2季度凿岩机零部件全生命周期分析报告',
          reportNo: 'BG-2025-Q2-001',
          type: '季度分析',
          period: '2025年Q2',
          status: '草稿',
          summary: '第二季度整体质量稳中有升，零部件全生命周期跟踪数据显示平均使用寿命达到设计标准的1.15倍。',
          conclusion: '建议下季度重点关注高磨损零部件的寿命优化及新型材料的应用验证。',
          author: '李明',
        }
      }),
      db.analysisReport.create({
        data: {
          title: '钻头类零部件专项寿命分析报告',
          reportNo: 'BG-2025-ZX-001',
          type: '专项分析',
          period: '2025年1月-6月',
          status: '已发布',
          summary: '对2025年上半年120个钻头样本进行全生命周期跟踪，平均使用寿命2850小时，其中球齿钻头寿命最长。',
          conclusion: '球齿钻头性价比最优，建议加大采购比例；十字钻头在硬岩场景下寿命不足，建议材料升级。',
          author: '王芳',
        }
      }),
    ])

    // 创建部门任务
    await Promise.all([
      db.task.create({
        data: {
          title: '整理6月份检测数据台账',
          description: '汇总6月份所有零部件检测记录，核对数据完整性，确保台账准确。',
          priority: '高',
          status: '进行中',
          assignee: '张伟',
          dueDate: new Date(2025, 6, 5),
        }
      }),
      db.task.create({
        data: {
          title: '编制Q2季度分析报告',
          description: '基于4-6月数据完成第二季度全生命周期质量分析报告。',
          priority: '高',
          status: '待办',
          assignee: '李明',
          dueDate: new Date(2025, 6, 10),
        }
      }),
      db.task.create({
        data: {
          title: '供应商质量数据汇总',
          description: '收集各供应商零部件检测数据，形成供应商质量对比分析表。',
          priority: '中',
          status: '待办',
          assignee: '王芳',
          dueDate: new Date(2025, 6, 15),
        }
      }),
      db.task.create({
        data: {
          title: '新检测标准学习培训',
          description: '组织部门人员学习最新版GB/T 6379检测标准。',
          priority: '低',
          status: '待办',
          assignee: '刘强',
          dueDate: new Date(2025, 6, 20),
        }
      }),
      db.task.create({
        data: {
          title: '上月异常数据分析',
          description: '对5月份不合格品进行原因分析，形成改进建议。',
          priority: '中',
          status: '已完成',
          assignee: '陈静',
          dueDate: new Date(2025, 6, 3),
        }
      }),
    ])

    return NextResponse.json({
      success: true,
      message: '种子数据创建成功',
      stats: {
        categories: categories.length,
        parts: parts.length,
        inspections: inspections.length,
        reports: 4,
        tasks: 5,
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}