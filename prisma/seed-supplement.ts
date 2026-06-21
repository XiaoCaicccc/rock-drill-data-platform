/**
 * 补充种子数据：Meeting、Document、AttendanceRecord
 * 直接使用 Prisma Client，不依赖 Next.js 服务器
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

async function main() {
  const t0 = Date.now()
  const rng = seededRandom(20250601)

  // ── 会议记录 ──
  const meetingDefs = [
    {
      title: '4月份质量分析例会',
      meetingDate: new Date(2025, 4, 6, 9, 0),
      location: '三楼会议室A',
      organizer: '张伟',
      status: '已完成',
      minutesContent: '1. 通报4月检测数据总体情况，合格率91.8%；2. 讨论气缸内壁粗糙度波动问题，决定加强供应商过程检验；3. 安排5月检测计划。',
      participants: [
        { name: '张伟', attended: true },
        { name: '李明', attended: true },
        { name: '王芳', attended: true },
        { name: '刘强', attended: true },
        { name: '陈静', attended: false },
      ],
    },
    {
      title: '5月份质量分析例会',
      meetingDate: new Date(2025, 5, 6, 9, 0),
      location: '三楼会议室A',
      organizer: '张伟',
      status: '已完成',
      minutesContent: '1. 5月合格率提升至92.5%；2. 维修设备DZ900-003送检结果分析；3. 下阶段工作部署：重点推进球齿钻头寿命验证试验。',
      participants: [
        { name: '张伟', attended: true },
        { name: '李明', attended: true },
        { name: '王芳', attended: true },
        { name: '刘强', attended: true },
        { name: '陈静', attended: true },
      ],
    },
    {
      title: 'Q2季度工作总结会',
      meetingDate: new Date(2025, 6, 2, 14, 0),
      location: '二楼大会议室',
      organizer: '李明',
      status: '待召开',
      minutesContent: null,
      participants: [
        { name: '张伟', attended: false },
        { name: '李明', attended: false },
        { name: '王芳', attended: false },
        { name: '刘强', attended: false },
        { name: '陈静', attended: false },
      ],
    },
    {
      title: '新检测设备采购评审会',
      meetingDate: new Date(2025, 5, 20, 10, 0),
      location: '技术部办公室',
      organizer: '王芳',
      status: '已完成',
      minutesContent: '1. 评审三坐标测量机采购方案，预算120万；2. 对比海克斯康、蔡司、三丰三品牌；3. 决议：推荐海克斯康方案，报领导审批。',
      participants: [
        { name: '张伟', attended: true },
        { name: '李明', attended: true },
        { name: '王芳', attended: true },
        { name: '刘强', attended: false },
      ],
    },
  ]

  let meetingCount = 0
  let participantCount = 0
  for (const m of meetingDefs) {
    const meeting = await db.meeting.create({
      data: {
        title: m.title,
        meetingDate: m.meetingDate,
        location: m.location,
        organizer: m.organizer,
        status: m.status,
        minutesContent: m.minutesContent,
      },
    })
    meetingCount++
    const pResult = await db.meetingParticipant.createMany({
      data: m.participants.map((p) => ({
        meetingId: meeting.id,
        name: p.name,
        attended: p.attended,
      })),
    })
    participantCount += pResult.count
  }
  console.log(`Meetings: ${meetingCount}, Participants: ${participantCount}`)

  // ── 文档归档 ──
  const docResults = await db.document.createMany({
    data: [
      { title: '2025年4月质量分析月报', category: '报告', archived: true, remark: '正式发布版' },
      { title: '2025年5月质量分析月报', category: '报告', archived: true, remark: '正式发布版' },
      { title: '钻头类专项寿命分析报告', category: '报告', archived: true, remark: '已发布' },
      { title: '4月份质量分析例会纪要', category: '纪要', archived: true, remark: '已归档' },
      { title: '5月份质量分析例会纪要', category: '纪要', archived: true, remark: '已归档' },
      { title: '新检测设备采购评审会纪要', category: '纪要', archived: false, remark: '待归档' },
      { title: '凿岩机零部件检测规范 V2.1', category: '标准', filePath: '/docs/standards/inspection-v2.1.pdf', archived: true, remark: '现行有效版本' },
      { title: 'GB/T 6379 测量方法与结果', category: '标准', filePath: '/docs/standards/GBT-6379.pdf', archived: true, remark: '参考标准' },
      { title: '数据分析师岗位作业指导书', category: '制度', filePath: '/docs/rules/job-guide.pdf', archived: true, remark: '部门内部文件' },
      { title: '检测设备操作规程', category: '制度', filePath: '/docs/rules/equipment-sop.pdf', archived: true, remark: '通用操作规程' },
    ],
  })
  console.log(`Documents: ${docResults.count}`)

  // ── 考勤记录（最近 2 个月，5 人 × ~44 个工作日） ──
  const members = ['张伟', '李明', '王芳', '刘强', '陈静']
  const attendanceData: Array<{ date: string; memberName: string; status: string; remark: string | null }> = []

  for (let month = 4; month <= 5; month++) {
    const daysInMonth = month === 4 ? 30 : 31
    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(2025, month - 1, day).getDay()
      if (dow === 0 || dow === 6) continue

      const dateStr = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      for (const member of members) {
        const r = rng()
        let status: string
        let remark: string | null = null

        if (r < 0.88) {
          status = '出勤'
        } else if (r < 0.93) {
          status = '请假'
          remark = member === '陈静' ? '年假' : '事假'
        } else if (r < 0.97) {
          status = '迟到'
          remark = '迟到10分钟'
        } else {
          status = '出差'
          remark = '供应商审核'
        }

        attendanceData.push({ date: dateStr, memberName: member, status, remark })
      }
    }
  }

  let attCount = 0
  for (let i = 0; i < attendanceData.length; i += 200) {
    const result = await db.attendanceRecord.createMany({ data: attendanceData.slice(i, i + 200) })
    attCount += result.count
  }
  console.log(`Attendance records: ${attCount}`)

  await db.$disconnect()
  console.log(`Supplement seed completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})