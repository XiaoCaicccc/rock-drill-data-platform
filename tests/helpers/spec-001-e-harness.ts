import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export type InspectionTimestampResult = {
  date: Date
  normalized: string
}

export type BatchValidationResult =
  | { success: true; data: unknown }
  | { success: false; status: number; code: string; error: string }

export type InspectionIntegrityHarness = {
  parseInspectionTimestamp: (
    value: unknown,
    options: { now: Date },
  ) => InspectionTimestampResult
  validateBatchInspectionRequest: (
    value: unknown,
    options: { now: Date },
  ) => BatchValidationResult
}

const require = createRequire(import.meta.url)

/**
 * Phase 1 red-test seam. The implementation phase must provide these exports from
 * src/lib/inspection-integrity.ts; tests deliberately fail until that module exists.
 */
export function loadInspectionIntegrityHarness(): InspectionIntegrityHarness {
  try {
    return require('../../src/lib/inspection-integrity.ts') as InspectionIntegrityHarness
  } catch (error) {
    assert.fail(
      `SPEC-001-E inspection integrity service is not implemented: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

export const fixedNow = new Date('2026-07-17T12:00:00.000Z')

export function validBatchRequest(itemCount = 1) {
  return {
    record: {
      equipment_id: 'equipment-1',
      inspection_date: '2026-07-17T11:00:00Z',
      batch_no: null,
      remark: null,
    },
    items: Array.from({ length: itemCount }, (_, index) => ({
      part_revision_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      param_item_id: `parameter-${index + 1}`,
      value_number: index,
      value_text: null,
    })),
  }
}
