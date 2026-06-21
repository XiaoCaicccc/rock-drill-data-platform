import { PrismaClient } from '@prisma/client'

// ============================================================
//  Types
// ============================================================

export interface SeedCounts {
  part_category: number
  equipment: number
  parameter_template: number
  parameter_item: number
  part: number
  inspection_record: number
  inspection_data_item: number
  analysis_report: number
  task: number
  meeting: number
  meeting_resolution: number
  document: number
  attendance_record: number
}

// Compact numeric param: { n: name, u: unit, s: [stdMin, stdMax], o: [optMin, optMax] }
// Compact text param:   { n: name, u: unit, t: 'opt1,opt2,opt3' }
type NP = { n: string; u: string; s: [number, number]; o: [number, number] }
type TP = { n: string; u: string; t: string }

// ============================================================
//  Helpers
// ============================================================

function normalRandom(mean: number, stdDev: number): number {
  let u1 = Math.random()
  let u2 = Math.random()
  while (u1 === 0) u1 = Math.random()
  return mean + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev
}

function isNP(d: NP | TP): d is NP {
  return 's' in d
}

function pad3(i: number): string {
  return String(i + 1).padStart(3, '0')
}

// ============================================================
//  1. Categories (6)
// ============================================================

const CATEGORIES = [
  { name: '钻头', code: 'ZT', description: '凿岩机钻头总成，含球齿形、十字形等类型' },
  { name: '活塞', code: 'HS', description: '冲击活塞，将冲击能传递至钻头' },
  { name: '气缸', code: 'QG', description: '气缸体，为活塞提供冲击行程空间' },
  { name: '阀组', code: 'FZ', description: '配气阀组，控制气路换向' },
  { name: '轴承', code: 'ZC', description: '主轴承及传动轴承组件' },
  { name: '密封件', code: 'MF', description: 'O型圈、油封、气封等密封组件' },
]

// ============================================================
//  2. Equipment (3)
// ============================================================

const EQUIPMENT = [
  {
    machine_no: 'ZYT-2024-001',
    model: 'COP1838ME',
    manufacturer: '阿特拉斯·科普柯',
    production_date: '2023-06-15',
    status: '在用',
    current_location: '1号采场-水平-东巷道',
    total_working_hours: 4580.5,
    remark: '主力设备，运行状态良好',
  },
  {
    machine_no: 'ZYT-2024-002',
    model: 'DD422i',
    manufacturer: '山特维克',
    production_date: '2022-11-20',
    status: '维修中',
    current_location: '维修车间-A区',
    total_working_hours: 6230.0,
    remark: '累计运行超6000小时，当前大修中',
  },
  {
    machine_no: 'ZYT-2024-003',
    model: 'Boomer S2',
    manufacturer: '阿特拉斯·科普柯',
    production_date: '2024-01-10',
    status: '库存',
    current_location: '设备库房-A区-3号架',
    total_working_hours: 120.0,
    remark: '新采购备用机，尚未投入生产',
  },
]

// ============================================================
//  3. Parts (12) — 2 per category, 6 per active equipment
// ============================================================

// [code, name, catCode, eqIndex (0/1/2), spec, material, supplier, workHours]
type PartDef = [string, string, string, number, string, string, string, number]

const PARTS_DEF: PartDef[] = [
  ['ZT-001', 'φ90球齿钻头',   'ZT', 0, 'D90×L400',        '硬质合金YG11C/40Cr',  '株洲硬质合金', 1520.5],
  ['ZT-002', 'φ102十字钻头',  'ZT', 1, 'D102×L420',       '硬质合金YG8/45Cr',    '自贡硬质合金', 2180.3],
  ['HS-001', 'φ75冲击活塞A',  'HS', 0, 'D75×L360',        '20CrMnTi渗碳淬火',    '洛阳轴承研究所', 890.2],
  ['HS-002', 'φ85冲击活塞B',  'HS', 1, 'D85×L380',        '20CrMnTi渗碳淬火',    '洛阳轴承研究所', 2340.8],
  ['QG-001', 'φ90气缸体A',    'QG', 0, 'ID90×L460',       '42CrMo调质',          '中船重工',       1520.5],
  ['QG-002', 'φ102气缸体B',   'QG', 1, 'ID102×L480',      '42CrMo调质',          '中船重工',       2180.3],
  ['FZ-001', 'COP配气阀组',   'FZ', 0, 'D52×L130',        'GCr15淬火回火',       '洛阳轴承研究所', 890.2],
  ['FZ-002', 'DD配气阀组',    'FZ', 1, 'D55×L135',        'GCr15淬火回火',       '洛阳轴承研究所', 2340.8],
  ['ZC-001', 'SKF主轴承A',    'ZC', 0, 'ID45×OD86×W26',  'GCr15',               'SKF中国',        1520.5],
  ['ZC-002', 'NSK主轴承B',    'ZC', 1, 'ID45×OD86×W26',  'GCr15',               'NSK中国',        2180.3],
  ['MF-001', '活塞密封组件',  'MF', 0, 'NBR O-RING D75',  '丁腈橡胶NBR',         '中鼎密封',       1520.5],
  ['MF-002', '气缸密封组件',  'MF', 1, 'PU SEAL D102',    '聚氨酯PU',            '中鼎密封',       2180.3],
]

// ============================================================
//  4. Parameter Definitions (6 categories × 40 items = 240)
// ============================================================

const CATEGORY_PARAMS: Record<string, (NP | TP)[]> = {
  // ────────────────── ZT 钻头 (38 numeric + 2 text) ──────────────────
  ZT: [
    { n: '外径',       u: 'mm',      s: [89, 91],     o: [89.5, 90.5] },
    { n: '内径',       u: 'mm',      s: [20, 22],     o: [20.5, 21.5] },
    { n: '总长度',     u: 'mm',      s: [380, 400],   o: [385, 395] },
    { n: '钢体长度',   u: 'mm',      s: [280, 300],   o: [285, 295] },
    { n: '头部直径',   u: 'mm',      s: [88, 92],     o: [89, 91] },
    { n: '合金齿高度', u: 'mm',      s: [5.0, 6.0],   o: [5.3, 5.7] },
    { n: '齿间距',     u: 'mm',      s: [12.0, 13.0], o: [12.3, 12.7] },
    { n: '排粉槽深度', u: 'mm',      s: [3.0, 4.0],   o: [3.3, 3.7] },
    { n: '排粉槽宽度', u: 'mm',      s: [6.0, 7.0],   o: [6.3, 6.7] },
    { n: '冲洗孔径',   u: 'mm',      s: [8, 12],      o: [9, 11] },
    { n: '冲洗孔数',   u: '个',      s: [3, 5],       o: [3, 4] },
    { n: '螺纹外径',   u: 'mm',      s: [32, 34],     o: [32.5, 33.5] },
    { n: '螺纹内径',   u: 'mm',      s: [28, 30],     o: [28.5, 29.5] },
    { n: '螺纹长度',   u: 'mm',      s: [80, 100],    o: [85, 95] },
    { n: '硬度HRC-齿部',  u: 'HRC', s: [38, 45],     o: [40, 43] },
    { n: '硬度HRC-体部',  u: 'HRC', s: [35, 42],     o: [37, 40] },
    { n: '抗拉强度',   u: 'MPa',     s: [900, 1100],  o: [950, 1050] },
    { n: '冲击韧性',   u: 'J/cm²',   s: [15, 25],     o: [18, 22] },
    { n: '碳化钨含量', u: '%',       s: [85, 92],     o: [87, 90] },
    { n: '钴含量',     u: '%',       s: [8, 15],      o: [10, 12] },
    { n: '密度',       u: 'g/cm³',   s: [14.0, 15.5], o: [14.5, 15.0] },
    { n: '弹性模量',   u: 'GPa',     s: [550, 650],   o: [580, 620] },
    { n: '热导率',     u: 'W/m·K',   s: [80, 120],    o: [90, 110] },
    { n: '孔隙率',     u: '%',       s: [0, 0.2],     o: [0, 0.1] },
    { n: '残余应力',   u: 'MPa',     s: [0, 200],     o: [0, 100] },
    { n: '晶粒度',     u: 'μm',      s: [0.5, 2.0],   o: [0.8, 1.5] },
    { n: '线膨胀系数', u: '10⁻⁶/K',  s: [5, 7],       o: [5.5, 6.5] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '内孔粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '端面粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '圆度',       u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.08],    o: [0, 0.03] },
    { n: '直线度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '位置度',     u: 'mm',      s: [0, 0.15],    o: [0, 0.08] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.12],    o: [0, 0.06] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],

  // ────────────────── HS 活塞 (38 numeric + 2 text) ──────────────────
  HS: [
    { n: '外径',       u: 'mm',      s: [75, 76],     o: [75.2, 75.8] },
    { n: '内径',       u: 'mm',      s: [18, 20],     o: [18.5, 19.5] },
    { n: '总长度',     u: 'mm',      s: [350, 370],   o: [355, 365] },
    { n: '大端直径',   u: 'mm',      s: [74, 75],     o: [74.2, 74.8] },
    { n: '小端直径',   u: 'mm',      s: [45, 46],     o: [45.3, 45.7] },
    { n: '大端长度',   u: 'mm',      s: [120, 130],   o: [123, 127] },
    { n: '小端长度',   u: 'mm',      s: [80, 90],     o: [83, 87] },
    { n: '密封槽宽',   u: 'mm',      s: [4.0, 5.0],   o: [4.3, 4.7] },
    { n: '密封槽深',   u: 'mm',      s: [2.5, 3.5],   o: [2.8, 3.2] },
    { n: '密封槽数',   u: '个',      s: [3, 5],       o: [4, 4] },
    { n: '硬度HRC',    u: 'HRC',     s: [40, 48],     o: [42, 46] },
    { n: '硬度均匀性', u: 'HRC',     s: [0, 3],       o: [0, 1.5] },
    { n: '抗拉强度',   u: 'MPa',     s: [800, 1000],  o: [850, 950] },
    { n: '屈服强度',   u: 'MPa',     s: [600, 800],   o: [650, 750] },
    { n: '冲击韧性',   u: 'J/cm²',   s: [20, 35],     o: [25, 30] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '圆度',       u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '直线度',     u: 'mm',      s: [0, 0.06],    o: [0, 0.03] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '垂直度',     u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '位置度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '对称度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '轮廓度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.06],    o: [0, 0.03] },
    { n: '倾斜度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '密封槽圆度', u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '密封槽粗糙度Ra', u: 'μm',  s: [0, 1.6],     o: [0, 0.8] },
    { n: '表面处理层厚', u: 'μm',     s: [10, 30],     o: [15, 25] },
    { n: '残余应力',   u: 'MPa',     s: [0, 150],     o: [0, 80] },
    { n: '疲劳寿命',   u: '万次',    s: [50, 100],    o: [65, 90] },
    { n: '密度',       u: 'g/cm³',   s: [7.8, 8.0],   o: [7.85, 7.95] },
    { n: '弹性模量',   u: 'GPa',     s: [200, 220],   o: [205, 215] },
    { n: '热膨胀系数', u: '10⁻⁶/K',  s: [11, 13],     o: [11.5, 12.5] },
    { n: '导热系数',   u: 'W/m·K',   s: [40, 55],     o: [45, 50] },
    { n: '质量',       u: 'kg',      s: [3.5, 4.0],   o: [3.6, 3.9] },
    { n: '重心偏移',   u: 'mm',      s: [0, 0.5],     o: [0, 0.25] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],

  // ────────────────── QG 气缸 (38 numeric + 2 text) ──────────────────
  QG: [
    { n: '内径',       u: 'mm',      s: [90, 91],     o: [90.2, 90.8] },
    { n: '外径',       u: 'mm',      s: [110, 112],   o: [110.5, 111.5] },
    { n: '总长度',     u: 'mm',      s: [450, 470],   o: [455, 465] },
    { n: '缸筒壁厚',   u: 'mm',      s: [9, 11],      o: [9.5, 10.5] },
    { n: '法兰外径',   u: 'mm',      s: [130, 135],   o: [131, 134] },
    { n: '法兰厚度',   u: 'mm',      s: [15, 20],     o: [16, 19] },
    { n: '进气口直径', u: 'mm',      s: [25, 28],     o: [25.5, 27.5] },
    { n: '排气口直径', u: 'mm',      s: [25, 28],     o: [25.5, 27.5] },
    { n: '螺栓孔径',   u: 'mm',      s: [12, 14],     o: [12.5, 13.5] },
    { n: '螺栓孔数',   u: '个',      s: [6, 8],       o: [6, 7] },
    { n: '硬度HRC',    u: 'HRC',     s: [28, 35],     o: [30, 33] },
    { n: '抗拉强度',   u: 'MPa',     s: [600, 800],   o: [650, 750] },
    { n: '屈服强度',   u: 'MPa',     s: [400, 600],   o: [450, 550] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '圆度',       u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '直线度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '垂直度',     u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '位置度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '对称度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '轮廓度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.06],    o: [0, 0.03] },
    { n: '内壁粗糙度Ra', u: 'μm',    s: [0, 1.6],     o: [0, 0.8] },
    { n: '螺栓孔位置度', u: 'mm',    s: [0, 0.2],     o: [0, 0.1] },
    { n: '法兰端面平面度', u: 'mm',  s: [0, 0.03],    o: [0, 0.015] },
    { n: '表面处理层厚', u: 'μm',     s: [20, 50],     o: [25, 45] },
    { n: '残余应力',   u: 'MPa',     s: [0, 100],     o: [0, 50] },
    { n: '气密性',     u: 'MPa',     s: [0.8, 1.2],   o: [0.9, 1.1] },
    { n: '水压试验',   u: 'MPa',     s: [1.5, 2.0],   o: [1.6, 1.9] },
    { n: '疲劳寿命',   u: '万次',    s: [100, 200],   o: [130, 180] },
    { n: '密度',       u: 'g/cm³',   s: [7.2, 7.5],   o: [7.3, 7.4] },
    { n: '弹性模量',   u: 'GPa',     s: [170, 190],   o: [175, 185] },
    { n: '热膨胀系数', u: '10⁻⁶/K',  s: [11, 13],     o: [11.5, 12.5] },
    { n: '导热系数',   u: 'W/m·K',   s: [45, 60],     o: [48, 55] },
    { n: '质量',       u: 'kg',      s: [18, 22],     o: [19, 21] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],

  // ────────────────── FZ 阀组 (38 numeric + 2 text) ──────────────────
  FZ: [
    { n: '阀体外径',   u: 'mm',      s: [50, 52],     o: [50.3, 51.7] },
    { n: '阀体内径',   u: 'mm',      s: [35, 37],     o: [35.5, 36.5] },
    { n: '阀芯直径',   u: 'mm',      s: [34, 36],     o: [34.3, 35.7] },
    { n: '阀座直径',   u: 'mm',      s: [34, 36],     o: [34.3, 35.7] },
    { n: '阀芯长度',   u: 'mm',      s: [80, 90],     o: [82, 88] },
    { n: '阀体长度',   u: 'mm',      s: [120, 130],   o: [122, 128] },
    { n: '进气口直径', u: 'mm',      s: [15, 18],     o: [15.5, 17.5] },
    { n: '排气口直径', u: 'mm',      s: [15, 18],     o: [15.5, 17.5] },
    { n: '控制口直径', u: 'mm',      s: [8, 12],      o: [9, 11] },
    { n: '密封槽宽',   u: 'mm',      s: [3.0, 4.0],   o: [3.3, 3.7] },
    { n: '密封槽深',   u: 'mm',      s: [1.5, 2.5],   o: [1.8, 2.2] },
    { n: '硬度HRC',    u: 'HRC',     s: [45, 52],     o: [47, 50] },
    { n: '硬度均匀性', u: 'HRC',     s: [0, 3],       o: [0, 1.5] },
    { n: '抗拉强度',   u: 'MPa',     s: [700, 900],   o: [750, 850] },
    { n: '屈服强度',   u: 'MPa',     s: [500, 700],   o: [550, 650] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 3.2],     o: [0, 1.6] },
    { n: '圆度',       u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '直线度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.03],    o: [0, 0.015] },
    { n: '垂直度',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '位置度',     u: 'mm',      s: [0, 0.08],    o: [0, 0.04] },
    { n: '对称度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '轮廓度',     u: 'mm',      s: [0, 0.04],    o: [0, 0.02] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '阀芯配合间隙', u: 'mm',    s: [0.01, 0.05], o: [0.02, 0.04] },
    { n: '密封面粗糙度Ra', u: 'μm',  s: [0, 0.8],     o: [0, 0.4] },
    { n: '密封面平面度', u: 'mm',    s: [0, 0.01],    o: [0, 0.005] },
    { n: '表面处理层厚', u: 'μm',     s: [5, 15],      o: [8, 12] },
    { n: '残余应力',   u: 'MPa',     s: [0, 120],     o: [0, 60] },
    { n: '响应时间',   u: 'ms',      s: [5, 15],      o: [7, 12] },
    { n: '换向次数',   u: '万次',    s: [100, 300],   o: [150, 250] },
    { n: '密封性',     u: 'MPa',     s: [1.0, 1.5],   o: [1.1, 1.4] },
    { n: '疲劳寿命',   u: '万次',    s: [80, 200],    o: [100, 170] },
    { n: '密度',       u: 'g/cm³',   s: [7.7, 7.9],   o: [7.75, 7.85] },
    { n: '弹性模量',   u: 'GPa',     s: [190, 210],   o: [195, 205] },
    { n: '质量',       u: 'kg',      s: [2.0, 2.8],   o: [2.2, 2.6] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],

  // ────────────────── ZC 轴承 (38 numeric + 2 text) ──────────────────
  ZC: [
    { n: '内径',       u: 'mm',      s: [45, 46],     o: [45.2, 45.8] },
    { n: '外径',       u: 'mm',      s: [85, 86],     o: [85.2, 85.8] },
    { n: '宽度',       u: 'mm',      s: [25, 26],     o: [25.2, 25.8] },
    { n: '内圈宽度',   u: 'mm',      s: [24, 25],     o: [24.3, 24.7] },
    { n: '外圈宽度',   u: 'mm',      s: [24, 25],     o: [24.3, 24.7] },
    { n: '滚动体直径', u: 'mm',      s: [8, 9],       o: [8.2, 8.8] },
    { n: '滚动体数量', u: '个',      s: [8, 12],      o: [9, 11] },
    { n: '保持架内径', u: 'mm',      s: [50, 52],     o: [50.5, 51.5] },
    { n: '保持架外径', u: 'mm',      s: [78, 80],     o: [78.5, 79.5] },
    { n: '滚道曲率半径', u: 'mm',    s: [4.1, 4.5],   o: [4.2, 4.4] },
    { n: '硬度HRC',    u: 'HRC',     s: [58, 65],     o: [60, 63] },
    { n: '硬度均匀性', u: 'HRC',     s: [0, 2],       o: [0, 1] },
    { n: '抗拉强度',   u: 'MPa',     s: [1200, 1500], o: [1300, 1400] },
    { n: '屈服强度',   u: 'MPa',     s: [1000, 1300], o: [1100, 1200] },
    { n: '冲击韧性',   u: 'J/cm²',   s: [10, 20],     o: [13, 17] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 1.6],     o: [0, 0.8] },
    { n: '圆度',       u: 'mm',      s: [0, 0.01],    o: [0, 0.005] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.015],   o: [0, 0.008] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '直线度',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.015],   o: [0, 0.008] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.01],    o: [0, 0.005] },
    { n: '垂直度',     u: 'mm',      s: [0, 0.01],    o: [0, 0.005] },
    { n: '位置度',     u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '对称度',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '轮廓度',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.02],    o: [0, 0.01] },
    { n: '径向游隙',   u: 'mm',      s: [0.01, 0.05], o: [0.015, 0.04] },
    { n: '轴向游隙',   u: 'mm',      s: [0.02, 0.08], o: [0.03, 0.06] },
    { n: '滚道粗糙度Ra', u: 'μm',    s: [0, 0.4],     o: [0, 0.2] },
    { n: '滚动体圆度', u: 'mm',      s: [0, 0.003],   o: [0, 0.002] },
    { n: '保持架间隙', u: 'mm',      s: [0.1, 0.3],   o: [0.15, 0.25] },
    { n: '表面处理层厚', u: 'μm',     s: [1, 5],       o: [2, 4] },
    { n: '残余应力',   u: 'MPa',     s: [0, 100],     o: [0, 50] },
    { n: '额定动载荷', u: 'kN',      s: [80, 120],    o: [90, 110] },
    { n: '额定静载荷', u: 'kN',      s: [60, 100],    o: [70, 90] },
    { n: '极限转速',   u: 'r/min',   s: [3000, 5000], o: [3500, 4500] },
    { n: '疲劳寿命',   u: '万转',    s: [500, 1000],  o: [650, 850] },
    { n: '密度',       u: 'g/cm³',   s: [7.8, 8.1],   o: [7.85, 8.05] },
    { n: '质量',       u: 'kg',      s: [1.0, 1.5],   o: [1.1, 1.4] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],

  // ────────────────── MF 密封件 (38 numeric + 2 text) ──────────────────
  MF: [
    { n: '内径',       u: 'mm',      s: [45, 46],     o: [45.3, 45.7] },
    { n: '外径',       u: 'mm',      s: [55, 56],     o: [55.2, 55.8] },
    { n: '截面直径',   u: 'mm',      s: [4.5, 5.5],   o: [4.8, 5.2] },
    { n: '线径',       u: 'mm',      s: [2.0, 3.0],   o: [2.3, 2.7] },
    { n: '自由高度',   u: 'mm',      s: [8, 12],      o: [9, 11] },
    { n: '压缩量',     u: '%',       s: [15, 30],     o: [18, 25] },
    { n: '拉伸强度',   u: 'MPa',     s: [10, 25],     o: [14, 22] },
    { n: '扯断伸长率', u: '%',       s: [200, 500],   o: [280, 420] },
    { n: '硬度ShoreA', u: 'ShoreA',  s: [65, 85],     o: [70, 80] },
    { n: '硬度均匀性', u: 'ShoreA',  s: [0, 5],       o: [0, 3] },
    { n: '永久变形',   u: '%',       s: [5, 20],      o: [8, 15] },
    { n: '撕裂强度',   u: 'kN/m',    s: [15, 40],     o: [20, 35] },
    { n: '回弹率',     u: '%',       s: [30, 60],     o: [38, 52] },
    { n: '耐磨性',     u: 'mm³',     s: [50, 200],    o: [80, 150] },
    { n: '表面粗糙度Ra', u: 'μm',    s: [0, 6.3],     o: [0, 3.2] },
    { n: '圆度',       u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '圆柱度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '同轴度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '直线度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '径向跳动',   u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '端面跳动',   u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '垂直度',     u: 'mm',      s: [0, 0.08],    o: [0, 0.04] },
    { n: '位置度',     u: 'mm',      s: [0, 0.15],    o: [0, 0.08] },
    { n: '对称度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '轮廓度',     u: 'mm',      s: [0, 0.1],     o: [0, 0.05] },
    { n: '全跳动',     u: 'mm',      s: [0, 0.12],    o: [0, 0.06] },
    { n: '密封面粗糙度Ra', u: 'μm',  s: [0, 3.2],     o: [0, 1.6] },
    { n: '密封面平面度', u: 'mm',    s: [0, 0.05],    o: [0, 0.025] },
    { n: '截面形状偏差', u: 'mm',    s: [0, 0.1],     o: [0, 0.05] },
    { n: '厚度均匀性', u: 'mm',      s: [0, 0.05],    o: [0, 0.025] },
    { n: '表面缺陷深度', u: 'mm',    s: [0, 0.1],     o: [0, 0.05] },
    { n: '残余应力',   u: 'MPa',     s: [0, 5],       o: [0, 2] },
    { n: '压缩永久变形', u: '%',     s: [5, 20],      o: [8, 15] },
    { n: '热空气老化硬度变化', u: 'ShoreA', s: [0, 10], o: [0, 5] },
    { n: '耐液体性质量变化', u: '%',  s: [0, 15],      o: [0, 8] },
    { n: '低温脆性温度', u: '℃',     s: [-60, -30],   o: [-50, -35] },
    { n: '气密性',     u: 'MPa',     s: [0.5, 1.5],   o: [0.8, 1.2] },
    { n: '疲劳寿命',   u: '万次',    s: [50, 200],    o: [80, 160] },
    { n: '密度',       u: 'g/cm³',   s: [1.1, 1.5],   o: [1.2, 1.4] },
    { n: '弹性模量',   u: 'MPa',     s: [5, 15],      o: [7, 12] },
    { n: '质量',       u: 'kg',      s: [0.01, 0.05], o: [0.015, 0.04] },
    { n: '探伤等级',   u: '-',       t: '合格,不合格,待复检' },
    { n: '外观检查',   u: '-',       t: '合格,不合格,待修' },
  ],
}

// ============================================================
//  5-9. Reports, Tasks, Meetings, Documents, Attendance
// ============================================================

const REPORTS = [
  {
    report_no: 'RPT-2025-001',
    title: '2025年1月凿岩机零件检测月度分析报告',
    type: '月度报告',
    period: '2025年1月',
    summary: '本月共完成20次检测，涵盖钻头、活塞、气缸等6类零件共12个件号，检测参数480项/次。整体合格率91.2%，较上月提升1.3个百分点，密封件类合格率偏低需重点关注。',
    conclusion: '建议加强密封件入厂检验，增备2套密封件库存；钻头磨损趋势平稳，可维持当前更换周期。',
    author: '张工',
    status: '已发布',
  },
  {
    report_no: 'RPT-2025-002',
    title: '2025年2月凿岩机零件检测月度分析报告',
    type: '月度报告',
    period: '2025年2月',
    summary: '本月完成20次检测，整体合格率93.5%，连续3个月呈上升趋势。阀组配合间隙项出现2次超标，已安排复检。活塞硬度均匀性稳定在良好区间。',
    conclusion: '阀组配合间隙波动与气源压力不稳有关，建议检修空压机；其余零件状态良好，维持当前检测频率。',
    author: '李工',
    status: '已发布',
  },
  {
    report_no: 'RPT-2025-003',
    title: '2025年Q1凿岩机配合参数季度分析报告',
    type: '季度报告',
    period: '2025年Q1',
    summary: '第一季度累计检测40次，生成检测数据9600条。6类零件中轴承和密封件合格率相对较低，分别为89.8%和88.5%。通过趋势分析发现活塞硬度随工作时长线性下降，建议建立寿命预测模型。',
    conclusion: 'Q1整体质量稳定，建议：(1)活塞建立硬度衰减曲线预测剩余寿命；(2)密封件提前更换周期由500h调整为450h；(3)轴承引入振动监测辅助判定。',
    author: '王工',
    status: '审核中',
  },
  {
    report_no: 'RPT-2025-004',
    title: 'COP1838ME凿岩机全生命周期分析报告',
    type: '全生命周期报告',
    period: '2022-2025',
    summary: 'ZYT-2024-001（COP1838ME）自2023年6月投入运行以来，累计工作4580.5小时。全生命周期内共更换钻头12次、活塞3次、密封组件8次。设备整体可用率达92.3%，MTBF（平均故障间隔时间）为680小时。',
    conclusion: '设备处于稳定运行期，各易损件更换周期已趋于规律。预计下一大修节点在累计8000小时（约2026年Q2），建议提前制定大修计划并储备关键备件。',
    author: '赵工',
    status: '草稿',
  },
]

const TASKS = [
  { title: 'ZYT-001钻头磨损趋势分析', description: '收集近6个月钻头检测数据，分析齿高、外径等关键参数的磨损趋势，建立预测模型', priority: '高', status: '进行中', assignee: '张工', due_date: '2025-03-15', task_type: '专项' },
  { title: 'ZYT-002气缸内壁精度复检', description: '针对上月气缸内径偏差接近下限的情况，安排一次全面复检，包含所有形位公差参数', priority: '高', status: '待办', assignee: '李工', due_date: '2025-03-20', task_type: '专项' },
  { title: '新批次密封件入库全检', description: '中鼎密封新到货的NBR和PU材质密封件各20套，需按检测模板进行全检入库', priority: '中', status: '已完成', assignee: '王工', due_date: '2025-02-28', task_type: '常规' },
  { title: 'COP1838ME大修方案制定', description: '根据全生命周期分析报告结论，制定COP1838ME凿岩机的大修方案，含时间节点、备件清单、人员安排', priority: '高', status: '待办', assignee: '赵工', due_date: '2025-04-01', task_type: '专项' },
  { title: 'Q1检测数据质量审核', description: '审核Q1全部检测记录的完整性和准确性，重点检查异常值标记和合格判定逻辑', priority: '中', status: '进行中', assignee: '刘工', due_date: '2025-03-31', task_type: '常规' },
]

const MEETINGS = [
  {
    title: '2025年1月质量分析会',
    meeting_date: '2025-01-28',
    location: '三楼会议室',
    organizer: '赵工',
    participants: '张工,李工,王工,赵工,刘工',
    minutes_content: '回顾1月检测数据，讨论密封件合格率偏低的原因及改进措施。决议加强入厂检验并增备库存。',
    status: '已完成',
  },
  {
    title: '设备维保协调会',
    meeting_date: '2025-02-15',
    location: '设备部办公室',
    organizer: '赵工',
    participants: '张工,李工,王工,设备主管',
    minutes_content: '协调ZYT-002大修计划时间节点，确认备件采购到货情况，安排维修期间的生产替代方案。',
    status: '已完成',
  },
  {
    title: '2025年Q1质量总结会',
    meeting_date: '2025-03-28',
    location: '三楼会议室',
    organizer: '王工',
    participants: '张工,李工,王工,赵工,刘工,车间主任',
    minutes_content: 'Q1质量总结待召开。',
    status: '待召开',
  },
]

const RESOLUTIONS = [
  // Meeting 1 (index 0)
  { meeting_idx: 0, content: '加强钻头入厂检验频率，由每批抽检改为全检', responsible_person: '张工', due_date: '2025-02-15', status: '已完成' },
  { meeting_idx: 0, content: '建立活塞疲劳寿命数据库，跟踪记录每次检测结果', responsible_person: '李工', due_date: '2025-03-31', status: '进行中' },
  // Meeting 2 (index 1)
  { meeting_idx: 1, content: 'ZYT-002安排3月第二周进行大修', responsible_person: '李工', due_date: '2025-03-14', status: '待执行' },
  { meeting_idx: 1, content: '增备两套密封件库存，最低库存量调整为10套', responsible_person: '王工', due_date: '2025-03-01', status: '已完成' },
  // Meeting 3 (index 2)
  { meeting_idx: 2, content: 'Q1各零件合格率目标不低于92%', responsible_person: '张工', due_date: '2025-03-31', status: '待执行' },
  { meeting_idx: 2, content: '推进检测数据电子化录入，减少纸质记录', responsible_person: '刘工', due_date: '2025-06-30', status: '待执行' },
]

const DOCUMENTS = [
  { title: '2025年1月检测月报', category: '月报', file_path: '/docs/reports/2025-01-monthly.pdf', related_report_no: 'RPT-2025-001' },
  { title: '2025年2月检测月报', category: '月报', file_path: '/docs/reports/2025-02-monthly.pdf', related_report_no: 'RPT-2025-002' },
  { title: 'COP1838ME维修手册(第三版)', category: '技术文档', file_path: '/docs/manuals/COP1838ME-manual-v3.pdf', related_report_no: null },
  { title: '凿岩机零件检测操作规程', category: '操作规程', file_path: '/docs/procedures/inspection-sop.pdf', related_report_no: null },
]

const ATTENDANCE_MEMBERS = ['张工', '李工', '王工', '赵工', '刘工']
const ATTENDANCE_DATES = ['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10', '2025-01-13']
const ATTENDANCE_POOL = ['出勤', '出勤', '出勤', '出勤', '出勤', '出勤', '出勤', '出勤', '出差', '请假'] // ~80% 出勤

// ============================================================
//  Seed Function
// ============================================================

export async function seedDatabase(prisma: PrismaClient): Promise<SeedCounts> {
  const counts: SeedCounts = {
    part_category: 0, equipment: 0, parameter_template: 0, parameter_item: 0,
    part: 0, inspection_record: 0, inspection_data_item: 0,
    analysis_report: 0, task: 0, meeting: 0, meeting_resolution: 0,
    document: 0, attendance_record: 0,
  }

  // ─── Step 0: Delete all tables (FK-safe order) ───
  console.log('[1/10] 清空所有表...')
  const deleteOps: Promise<any>[] = [
    prisma.inspection_data_item.deleteMany(),
    prisma.meeting_resolution.deleteMany(),
    prisma.inspection_record.deleteMany(),
    prisma.parameter_item.deleteMany(),
    prisma.parameter_template.deleteMany(),
    prisma.part.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.analysis_report.deleteMany(),
    prisma.task.deleteMany(),
    prisma.document.deleteMany(),
    prisma.attendance_record.deleteMany(),
    prisma.equipment.deleteMany(),
    prisma.part_category.deleteMany(),
  ]
  await Promise.all(deleteOps)

  // ─── Step 1: Categories ───
  console.log('[2/10] 创建零件类别...')
  await prisma.part_category.createMany({
    data: CATEGORIES.map(c => ({ ...c, standard_param_count: 40 })),
  })
  const categories = await prisma.part_category.findMany()
  counts.part_category = categories.length
  const catMap = new Map(categories.map(c => [c.code, c]))

  // ─── Step 2: Equipment ───
  console.log('[3/10] 创建设备档案...')
  await prisma.equipment.createMany({
    data: EQUIPMENT.map(e => ({
      ...e,
      production_date: e.production_date ? new Date(e.production_date) : null,
    })),
  })
  const equipment = await prisma.equipment.findMany()
  counts.equipment = equipment.length
  const eqByIdx = [equipment.find(e => e.machine_no === 'ZYT-2024-001')!,
                    equipment.find(e => e.machine_no === 'ZYT-2024-002')!,
                    equipment.find(e => e.machine_no === 'ZYT-2024-003')!]

  // ─── Step 3: Parameter Templates & Items ───
  console.log('[4/10] 创建参数模板和参数项...')
  const catParamMap = new Map<string, { id: string; stdMin: number | null; stdMax: number | null; optMin: number | null; optMax: number | null; dataType: string; options: string | null }[]>()

  for (const cat of categories) {
    const params = CATEGORY_PARAMS[cat.code]
    if (!params) continue

    const template = await prisma.parameter_template.create({
      data: { category_id: cat.id, name: `${cat.name}检测参数模板 V1`, version: 1 },
    })
    counts.parameter_template++

    const paramItemsData = params.map((p, i) => {
      if (isNP(p)) {
        return {
          template_id: template.id,
          param_name: p.n,
          param_code: `${cat.code}_${pad3(i)}`,
          unit: p.u,
          data_type: 'number',
          standard_min: p.s[0],
          standard_max: p.s[1],
          optimal_min: p.o[0],
          optimal_max: p.o[1],
          sort_order: i,
          options: null,
        }
      } else {
        return {
          template_id: template.id,
          param_name: p.n,
          param_code: `${cat.code}_${pad3(i)}`,
          unit: p.u,
          data_type: 'text',
          standard_min: null,
          standard_max: null,
          optimal_min: null,
          optimal_max: null,
          sort_order: i,
          options: p.t,
        }
      }
    })

    await prisma.parameter_item.createMany({ data: paramItemsData })
    counts.parameter_item += paramItemsData.length

    // Query back to get IDs
    const createdParams = await prisma.parameter_item.findMany({
      where: { template_id: template.id },
      orderBy: { sort_order: 'asc' },
    })
    catParamMap.set(cat.id, createdParams.map(cp => ({
      id: cp.id,
      stdMin: cp.standard_min,
      stdMax: cp.standard_max,
      optMin: cp.optimal_min,
      optMax: cp.optimal_max,
      dataType: cp.data_type,
      options: cp.options,
    })))
  }

  // ─── Step 4: Parts ───
  console.log('[5/10] 创建零件档案...')
  const partsData = PARTS_DEF.map(([code, name, catCode, eqIdx, spec, material, supplier, wh]) => ({
    code,
    name,
    category_id: catMap.get(catCode)!.id,
    equipment_id: eqByIdx[eqIdx]?.id ?? null,
    specification: spec,
    material,
    supplier,
    install_date: new Date('2024-06-01'),
    working_hours: wh,
    status: '在用',
    remark: null,
  }))
  await prisma.part.createMany({ data: partsData })
  const parts = await prisma.part.findMany()
  counts.part = parts.length

  // Build: equipment_id -> parts[]
  const eqPartsMap = new Map(equipment.map(e => [e.id, parts.filter(p => p.equipment_id === e.id)]))

  // ─── Step 5: Inspection Records & Data Items ───
  console.log('[6/10] 创建检测记录和明细数据...')
  const INSPECTORS = ['张工', '李工', '王工', '赵工', '刘工']
  const INSPECTION_DATES = [
    [5, 11, 17, 23, 29], // January
    [5, 11, 17, 23, 27], // February
  ]
  // 2 active equipment (even though equipment 2 is 维修中, it still gets inspections)
  const ACTIVE_EQ_INDICES = [0, 1]

  for (const eqIdx of ACTIVE_EQ_INDICES) {
    const eq = eqByIdx[eqIdx]
    const eqParts = eqPartsMap.get(eq.id) || []

    for (let m = 0; m < 2; m++) {
      const month = m + 1
      for (let r = 0; r < 5; r++) {
        const day = INSPECTION_DATES[m][r]
        const dateStr = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const recordNo = `JC-2025${String(month).padStart(2, '0')}-${eqIdx + 1}-${String(r + 1).padStart(2, '0')}`
        const batchNo = `PC-2025${String(month).padStart(2, '0')}-${eqIdx + 1}-${String(r + 1).padStart(2, '0')}`

        const record = await prisma.inspection_record.create({
          data: {
            record_no: recordNo,
            equipment_id: eq.id,
            inspector: INSPECTORS[(eqIdx * 10 + m * 5 + r) % INSPECTORS.length],
            batch_no: batchNo,
            inspection_date: new Date(dateStr),
            overall_result: '待检',
            remark: null,
          },
        })
        counts.inspection_record++

        // Generate data items for all parts of this equipment
        const dataItems: {
          record_id: string
          part_id: string
          param_item_id: string
          value_number: number | null
          value_text: string | null
          is_qualified: boolean | null
          is_optimal: boolean | null
        }[] = []

        for (const part of eqParts) {
          const paramDefs = catParamMap.get(part.category_id)
          if (!paramDefs) continue

          for (const pd of paramDefs) {
            if (pd.dataType === 'text' && pd.options) {
              const opts = pd.options.split(',')
              const val = opts[Math.floor(Math.random() * opts.length)]
              const qualified = val === '合格'
              dataItems.push({
                record_id: record.id,
                part_id: part.id,
                param_item_id: pd.id,
                value_number: null,
                value_text: val,
                is_qualified: qualified,
                is_optimal: qualified,
              })
            } else if (pd.stdMin !== null && pd.stdMax !== null && pd.optMin !== null && pd.optMax !== null) {
              const mean = (pd.stdMin + pd.stdMax) / 2
              const stdDev = (pd.stdMax - pd.stdMin) / 4
              const value = Math.round(normalRandom(mean, stdDev) * 100) / 100
              const qualified = value >= pd.stdMin && value <= pd.stdMax
              const optimal = value >= pd.optMin && value <= pd.optMax
              dataItems.push({
                record_id: record.id,
                part_id: part.id,
                param_item_id: pd.id,
                value_number: value,
                value_text: null,
                is_qualified: qualified,
                is_optimal: optimal,
              })
            }
          }
        }

        await prisma.inspection_data_item.createMany({ data: dataItems })
        counts.inspection_data_item += dataItems.length

        // Update overall_result based on qualification rate
        const qCount = dataItems.filter(d => d.is_qualified).length
        const qRate = dataItems.length > 0 ? qCount / dataItems.length : 0
        let overallResult = '不合格'
        if (qRate >= 0.95) overallResult = '优秀'
        else if (qRate >= 0.80) overallResult = '合格'
        else if (qRate >= 0.60) overallResult = '待修'

        await prisma.inspection_record.update({
          where: { id: record.id },
          data: { overall_result: overallResult },
        })
      }
    }
  }

  // ─── Step 6: Reports ───
  console.log('[7/10] 创建分析报告...')
  await prisma.analysis_report.createMany({ data: REPORTS })
  counts.analysis_report = REPORTS.length

  // ─── Step 7: Tasks ───
  console.log('[8/10] 创建任务...')
  await prisma.task.createMany({
    data: TASKS.map(t => ({
      ...t,
      due_date: t.due_date ? new Date(t.due_date) : null,
    })),
  })
  counts.task = TASKS.length

  // ─── Step 8: Meetings & Resolutions ───
  console.log('[9/10] 创建会议和决议...')
  await prisma.meeting.createMany({
    data: MEETINGS.map(m => ({
      ...m,
      meeting_date: new Date(m.meeting_date),
    })),
  })
  const createdMeetings = await prisma.meeting.findMany({ orderBy: { meeting_date: 'asc' } })
  counts.meeting = createdMeetings.length

  const resolutionData = RESOLUTIONS.map(r => ({
    meeting_id: createdMeetings[r.meeting_idx].id,
    content: r.content,
    responsible_person: r.responsible_person,
    due_date: r.due_date ? new Date(r.due_date) : null,
    status: r.status,
  }))
  await prisma.meeting_resolution.createMany({ data: resolutionData })
  counts.meeting_resolution = resolutionData.length

  // ─── Step 9: Documents & Attendance ───
  console.log('[10/10] 创建文档和考勤记录...')

  // Documents: resolve related_report_id
  const reportIdMap = new Map<string, string>()
  const allReports = await prisma.analysis_report.findMany()
  for (const r of allReports) reportIdMap.set(r.report_no, r.id)

  await prisma.document.createMany({
    data: DOCUMENTS.map(d => ({
      title: d.title,
      category: d.category,
      file_path: d.file_path,
      related_report_id: d.related_report_no ? reportIdMap.get(d.related_report_no) || null : null,
      archived: false,
    })),
  })
  counts.document = DOCUMENTS.length

  // Attendance
  const attendanceData = ATTENDANCE_MEMBERS.flatMap(name =>
    ATTENDANCE_DATES.map(date => ({
      date: new Date(date),
      member_name: name,
      status: ATTENDANCE_POOL[Math.floor(Math.random() * ATTENDANCE_POOL.length)],
      remark: null,
    })),
  )
  await prisma.attendance_record.createMany({ data: attendanceData })
  counts.attendance_record = attendanceData.length

  // ─── Summary ───
  console.log('\n✅ 种子数据创建完成！')
  console.table(counts)
  return counts
}

// ============================================================
//  Standalone Execution
// ============================================================

async function main() {
  const prisma = new PrismaClient()
  try {
    const counts = await seedDatabase(prisma)
    console.log('\nDone. Total inspection_data_item:', counts.inspection_data_item)
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()