import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildParameterAnalysisMatchKey,
  pairParameterAnalysisItems,
} from '../src/lib/parameter-analysis'

type TestItem = {
  id: string
  record_id: string
  part_revision_id: string | null
}

const parameterA = 'parameter-a'
const parameterB = 'parameter-b'

function item(id: string, recordId: string, revisionId: string | null): TestItem {
  return { id, record_id: recordId, part_revision_id: revisionId }
}

test('matches items with the same record and part revision for the selected parameter pair', () => {
  const pairs = pairParameterAnalysisItems(
    [item('a', 'record-1', 'revision-1')],
    [item('b', 'record-1', 'revision-1')],
    parameterA,
    parameterB,
  )

  assert.deepEqual(pairs.map(({ itemA, itemB }) => [itemA.id, itemB.id]), [['a', 'b']])
})

test('does not match the same record when part revisions differ', () => {
  const pairs = pairParameterAnalysisItems(
    [item('a', 'record-1', 'revision-1')],
    [item('b', 'record-1', 'revision-2')],
    parameterA,
    parameterB,
  )

  assert.deepEqual(pairs, [])
})

test('does not treat record id alone as a sufficient match key', () => {
  const pairs = pairParameterAnalysisItems(
    [item('a', 'record-1', 'revision-a')],
    [item('b', 'record-1', 'revision-b')],
    parameterA,
    parameterB,
  )

  assert.equal(pairs.length, 0)
})

test('keeps the selected parameter pair in the composite key', () => {
  const baseKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-1',
    parameterA,
    parameterB,
  )
  const otherParameterKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-1',
    parameterA,
    'parameter-c',
  )

  assert.notEqual(baseKey, otherParameterKey)
})

test('keeps different part revisions separate in the composite key', () => {
  const firstKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-1',
    parameterA,
    parameterB,
  )
  const secondKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-2',
    parameterA,
    parameterB,
  )

  assert.notEqual(firstKey, secondKey)
})

test('excludes missing and empty part revision ids', () => {
  const pairs = pairParameterAnalysisItems(
    [item('missing-a', 'record-1', null), item('empty-a', 'record-2', '')],
    [item('missing-b', 'record-1', null), item('empty-b', 'record-2', '')],
    parameterA,
    parameterB,
  )

  assert.deepEqual(pairs, [])
})

test('does not let an unknown-version item pollute a known-version match', () => {
  const pairs = pairParameterAnalysisItems(
    [item('known-a', 'record-1', 'revision-1')],
    [
      item('unknown-b', 'record-1', null),
      item('known-b', 'record-1', 'revision-1'),
    ],
    parameterA,
    parameterB,
  )

  assert.deepEqual(pairs.map(({ itemA, itemB }) => [itemA.id, itemB.id]), [
    ['known-a', 'known-b'],
  ])
})

test('generates stable keys for the same composite input', () => {
  const firstKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-1',
    parameterA,
    parameterB,
  )
  const secondKey = buildParameterAnalysisMatchKey(
    'record-1',
    'revision-1',
    parameterA,
    parameterB,
  )

  assert.equal(firstKey, secondKey)
})
