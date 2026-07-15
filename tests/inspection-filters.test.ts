import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInspectionRecordFilters,
  normalizeInspectionFilterParams,
} from '../src/lib/inspection-filters'

function build(params: URLSearchParams, includeLegacyDateAliases = false) {
  return buildInspectionRecordFilters(
    normalizeInspectionFilterParams(params, { includeLegacyDateAliases }),
  )
}

function searchClauses(where: ReturnType<typeof buildInspectionRecordFilters>['where']) {
  assert.ok(Array.isArray(where.OR))
  return where.OR
}

test('does not create a search condition for absent, empty, or whitespace-only search terms', () => {
  for (const params of [
    new URLSearchParams(),
    new URLSearchParams({ search: '' }),
    new URLSearchParams({ search: '   ' }),
  ]) {
    const { where, error } = build(params)
    assert.equal(error, null)
    assert.equal(where.OR, undefined)
  }
})

test('normalizes search terms and applies them to the inspection record number', () => {
  const filters = normalizeInspectionFilterParams(new URLSearchParams({ search: '  IR-001  ' }))
  const { where, error } = buildInspectionRecordFilters(filters)

  assert.equal(error, null)
  assert.equal(filters.search, 'IR-001')
  assert.deepEqual(searchClauses(where)[0], {
    record_no: { contains: 'IR-001', mode: 'insensitive' },
  })
})

test('applies search terms to the inspector field', () => {
  const { where } = build(new URLSearchParams({ search: 'Zhang' }))

  assert.deepEqual(searchClauses(where)[1], {
    inspector: { contains: 'Zhang', mode: 'insensitive' },
  })
})

test('applies search terms to the batch number field', () => {
  const { where } = build(new URLSearchParams({ search: 'BATCH-01' }))

  assert.deepEqual(searchClauses(where)[2], {
    batch_no: { contains: 'BATCH-01', mode: 'insensitive' },
  })
})

test('searches part names through inspection data items', () => {
  const { where } = build(new URLSearchParams({ search: 'piston' }))

  assert.deepEqual(searchClauses(where)[3], {
    data_items: {
      some: {
        part: {
          OR: [
            { name: { contains: 'piston', mode: 'insensitive' } },
            { code: { contains: 'piston', mode: 'insensitive' } },
          ],
        },
      },
    },
  })
})

test('searches part codes through the same inspection data item relation', () => {
  const { where } = build(new URLSearchParams({ search: 'PT-100' }))
  const partSearch = searchClauses(where)[3] as {
    data_items: { some: { part: { OR: Array<{ code?: { contains: string } }> } } }
  }

  assert.equal(partSearch.data_items.some.part.OR[1].code?.contains, 'PT-100')
})

test('uses the existing result filter and does not restrict results when it is absent', () => {
  const withResult = build(new URLSearchParams({ result: '合格' }))
  const withoutResult = build(new URLSearchParams())

  assert.equal(withResult.where.overall_result, '合格')
  assert.equal(withoutResult.where.overall_result, undefined)
})

test('uses the shared UTC date boundaries and keeps export legacy aliases compatible', () => {
  const { where, error } = build(new URLSearchParams({
    startDate: '2026-07-01',
    endDate: '2026-07-02',
  }))
  const inspectionDate = where.inspection_date as { gte: Date; lte: Date }
  const legacy = normalizeInspectionFilterParams(
    new URLSearchParams({ date_from: '2026-07-03', date_to: '2026-07-04' }),
    { includeLegacyDateAliases: true },
  )

  assert.equal(error, null)
  assert.equal(inspectionDate.gte.toISOString(), '2026-07-01T00:00:00.000Z')
  assert.equal(inspectionDate.lte.toISOString(), '2026-07-02T23:59:59.999Z')
  assert.deepEqual(legacy, {
    search: '',
    categoryId: '',
    result: '',
    startDate: '2026-07-03',
    endDate: '2026-07-04',
  })
})

test('keeps search, category, result, and date filters together', () => {
  const { where, error } = build(new URLSearchParams({
    search: 'PT-100',
    categoryId: 'category-1',
    result: '合格',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
  }))

  assert.equal(error, null)
  assert.equal(searchClauses(where).length, 4)
  assert.equal(where.overall_result, '合格')
  assert.deepEqual(where.data_items, {
    some: { part: { category_id: 'category-1' } },
  })
  assert.ok(where.inspection_date)
})

test('rejects invalid and reversed shared date ranges', () => {
  assert.equal(
    build(new URLSearchParams({ startDate: 'not-a-date' })).error,
    'invalid_date',
  )
  assert.equal(
    build(new URLSearchParams({ startDate: '2026-07-02', endDate: '2026-07-01' })).error,
    'invalid_date_range',
  )
})
