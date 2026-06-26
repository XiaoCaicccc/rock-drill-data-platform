/**
 * Spec-012b 独立测试脚本
 * 验证：
 *  1. parameter-templates categoryId 过滤
 *  2. param-comparison 完整数据流（内连接、皮尔逊、直方图、统计）
 */
import { PrismaClient } from '@prisma/client'
import { resolve } from 'path'

// 显式指定 DB 路径，避免 shell 环境变量 / .env 路径歧义
const db = new PrismaClient({
  datasources: { db: { url: `file:${resolve('prisma/dev.db')}` } },
})

// ── 手写皮尔逊公式（与 route.ts 一致）──
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2) return null
  const sumX = xs.reduce((s, v) => s + v, 0)
  const sumY = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumX2 = xs.reduce((s, v) => s + v * v, 0)
  const sumY2 = ys.reduce((s, v) => s + v * v, 0)
  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return den === 0 ? 0 : Math.round((num / den) * 10000) / 10000
}

// ── 10 等宽直方图（与 route.ts 一致）──
function histogram(values: number[]) {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const w = range === 0 ? 1 : range / 10
  const start = range === 0 ? min - 0.5 : min
  const bins = Array.from({ length: 10 }, (_, i) => ({ lo: start + i * w, hi: start + (i + 1) * w, count: 0 }))
  for (const v of values) {
    let idx = Math.floor((v - start) / w)
    if (idx < 0) idx = 0
    if (idx > 9) idx = 9
    bins[idx].count++
  }
  return bins.map(b => ({ rangeLabel: `${b.lo.toFixed(2)}~${b.hi.toFixed(2)}`, count: b.count }))
}

let pass = 0
let fail = 0
const ok = (cond: boolean, msg: string) => { console.log(cond ? `  ✅ ${msg}` : `  ❌ ${msg}`); cond ? pass++ : fail++ }

async function main() {
  // ── 1. 类别 + 模板 ──
  console.log('\n=== 1. Categories & Templates ===')
  const cats = await db.part_category.findMany({
    include: { parameter_template: { include: { items: { orderBy: { sort_order: 'asc' } } } } },
    orderBy: { code: 'asc' },
  })
  ok(cats.length === 6, `6 categories (${cats.length})`)
  const withTpl = cats.filter(c => c.parameter_template)
  ok(withTpl.length === 6, `${withTpl.length} have templates`)
  const first = withTpl[0]
  ok((first.parameter_template?.items.length ?? 0) > 0, `"${first.name}" has ${first.parameter_template?.items.length} items`)
  const nums = first.parameter_template?.items.filter(i => i.data_type === 'number') ?? []
  ok(nums.length > 1, `${nums.length} numeric params available`)

  // ── 2. categoryId 过滤 ──
  console.log('\n=== 2. parameter-templates categoryId filter ===')
  const filtered = await db.parameter_template.findMany({
    where: { category_id: first.id },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  })
  ok(filtered.length === 1, `Returns 1 template (got ${filtered.length})`)
  ok(filtered[0].category_id === first.id, 'Correct category')

  // ── 3. 参数对比完整数据流 ──
  console.log('\n=== 3. Param comparison data flow ===')
  const pA = nums[0]
  const pB = nums[1]
  const rowsA = await db.inspection_data_item.findMany({
    where: { param_item_id: pA.id, value_number: { not: null } },
    select: { record_id: true, value_number: true, is_qualified: true },
  })
  const rowsB = await db.inspection_data_item.findMany({
    where: { param_item_id: pB.id, value_number: { not: null } },
    select: { record_id: true, value_number: true, is_qualified: true },
  })
  const mapA = new Map(rowsA.map(r => [r.record_id, r]))

  interface DP { valueA: number; valueB: number; isQualified: boolean }
  const joined: DP[] = []
  for (const rb of rowsB) {
    const ra = mapA.get(rb.record_id)
    if (ra && ra.value_number != null && rb.value_number != null) {
      joined.push({
        valueA: ra.value_number,
        valueB: rb.value_number,
        isQualified: ra.is_qualified === true && rb.is_qualified === true,
      })
    }
  }
  ok(joined.length > 0, `Inner join: ${joined.length} data points`)

  if (joined.length >= 2) {
    const xs = joined.map(d => d.valueA)
    const ys = joined.map(d => d.valueB)
    const r = pearson(xs, ys)
    ok(r !== null, `Pearson r = ${r}`)
    ok(r! >= -1 && r! <= 1, 'r in [-1, 1]')

    const hA = histogram(xs)
    const hB = histogram(ys)
    ok(hA.length === 10, `Hist A: 10 bins`)
    ok(hB.length === 10, `Hist B: 10 bins`)
    ok(hA.reduce((s, b) => s + b.count, 0) === joined.length, `Hist A sum == ${joined.length}`)
    ok(hB.reduce((s, b) => s + b.count, 0) === joined.length, `Hist B sum == ${joined.length}`)

    // standard/optimal ranges exist for reference lines
    ok(pA.standard_min != null || pA.standard_max != null, `"${pA.param_name}" has std range`)
    ok(pA.optimal_min != null || pA.optimal_max != null, `"${pA.param_name}" has opt range`)

    // stats
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length
    const std = Math.sqrt(xs.reduce((s, v) => s + (v - mean) ** 2, 0) / xs.length)
    ok(!isNaN(mean) && !isNaN(std), `Mean=${mean.toFixed(4)} Std=${std.toFixed(4)}`)
  }

  // ── 4. Equipment ──
  console.log('\n=== 4. Equipment dropdown ===')
  const eqs = await db.equipment.findMany()
  ok(eqs.length > 0, `${eqs.length} equipment entries`)

  // ── Summary ──
  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())