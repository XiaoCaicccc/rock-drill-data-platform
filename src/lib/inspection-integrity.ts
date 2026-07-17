import {
  InspectionDomainError,
  type BatchInspectionErrorCode,
} from './inspection-errors'

export type ParsedInspectionTimestamp = {
  date: Date
  normalized: string
}

export type BatchInspectionItem = {
  part_revision_id: string
  param_item_id: string
  value_number: number | null
  value_text: string | null
}

export type BatchInspectionRequest = {
  record: {
    equipment_id: string
    inspection_date: string
    batch_no?: string | null
    remark?: string | null
  }
  items: BatchInspectionItem[]
}

export type BatchInspectionValidationResult =
  | { success: true; data: BatchInspectionRequest }
  | { success: false; status: number; code: BatchInspectionErrorCode; error: string }

const RFC3339_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function invalidRequest(message: string): never {
  throw new InspectionDomainError('INVALID_REQUEST', message)
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Strict SPEC-001-E 6.5 timestamp parser. */
export function parseInspectionTimestamp(
  value: unknown,
  options: { now: Date },
): ParsedInspectionTimestamp {
  if (typeof value !== 'string' || value.trim() !== value) {
    invalidRequest('检测时间必须是带时区的 RFC 3339 date-time')
  }

  const match = RFC3339_DATE_TIME.exec(value)
  if (!match) invalidRequest('检测时间必须是带时区的 RFC 3339 date-time')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const millisecond = Number((match[7] ?? '').padEnd(3, '0'))
  const offsetHour = match[8] === 'Z' ? 0 : Number(match[10])
  const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11])

  if (
    month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) {
    invalidRequest('检测时间包含无效的日期、时间或时区偏移')
  }

  const local = new Date(0)
  local.setUTCFullYear(year, month - 1, day)
  local.setUTCHours(hour, minute, second, millisecond)
  const offsetSign = match[9] === '-' ? -1 : 1
  const offsetMilliseconds = offsetSign * (offsetHour * 60 + offsetMinute) * 60_000
  const instant = new Date(local.getTime() - offsetMilliseconds)

  if (!Number.isFinite(instant.getTime())) invalidRequest('检测时间超出支持范围')
  if (!Number.isFinite(options.now?.getTime())) invalidRequest('服务端时间无效')
  if (instant.getTime() > options.now.getTime()) invalidRequest('检测时间不能晚于当前时间')

  return { date: instant, normalized: instant.toISOString() }
}

const TOP_LEVEL_FIELDS = new Set(['record', 'items'])
const RECORD_FIELDS = new Set(['equipment_id', 'inspection_date', 'batch_no', 'remark'])
const ITEM_FIELDS = new Set([
  'part_revision_id',
  'param_item_id',
  'value_number',
  'value_text',
])

const FORBIDDEN_FIELDS = new Set([
  'user_id',
  'created_by',
  'organization_id',
  'inspector',
  'record_no',
  'overall_result',
  'part_id',
  'is_qualified',
  'is_optimal',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rejectUnexpectedFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      const label = FORBIDDEN_FIELDS.has(field) ? '禁止字段' : '未知字段'
      throw new InspectionDomainError('FORBIDDEN_FIELD', `${label}: ${field}`)
    }
  }
}

function requireNonEmptyString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalidRequest(`${label}不能为空`)
  }
  return value.trim()
}

function optionalText(value: unknown, label: string) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') invalidRequest(`${label}必须是字符串或 null`)
  return value.trim() || null
}

function validationFailure(error: InspectionDomainError): BatchInspectionValidationResult {
  return {
    success: false,
    status: error.status,
    code: error.code,
    error: error.message,
  }
}

/** Strict SPEC-001-E 6.6 batch request validator. */
export function validateBatchInspectionRequest(
  value: unknown,
  options: { now: Date },
): BatchInspectionValidationResult {
  try {
    if (!isObject(value)) invalidRequest('请求体必须是 JSON 对象')
    rejectUnexpectedFields(value, TOP_LEVEL_FIELDS)
    if (!isObject(value.record)) invalidRequest('record 必须是 JSON 对象')
    rejectUnexpectedFields(value.record, RECORD_FIELDS)
    if (!Array.isArray(value.items)) invalidRequest('items 必须是数组')
    if (value.items.length === 0) {
      throw new InspectionDomainError('EMPTY_BATCH', '检测数据不能为空')
    }
    if (value.items.length > 500) {
      throw new InspectionDomainError('BATCH_TOO_LARGE', '检测数据不能超过 500 条')
    }

    const equipmentId = requireNonEmptyString(value.record.equipment_id, 'equipment_id')
    const parsedTimestamp = parseInspectionTimestamp(value.record.inspection_date, options)
    const batchNo = optionalText(value.record.batch_no, 'batch_no')
    const remark = optionalText(value.record.remark, 'remark')
    const seen = new Set<string>()

    const items = value.items.map((candidate, index): BatchInspectionItem => {
      if (!isObject(candidate)) invalidRequest(`items[${index}] 必须是 JSON 对象`)
      rejectUnexpectedFields(candidate, ITEM_FIELDS)

      const revisionId = requireNonEmptyString(
        candidate.part_revision_id,
        `items[${index}].part_revision_id`,
      ).toLowerCase()
      if (!UUID.test(revisionId)) invalidRequest(`items[${index}].part_revision_id 必须是 UUID`)
      const parameterId = requireNonEmptyString(
        candidate.param_item_id,
        `items[${index}].param_item_id`,
      )

      if (!Object.hasOwn(candidate, 'value_number') || !Object.hasOwn(candidate, 'value_text')) {
        invalidRequest(`items[${index}] 必须显式提供 value_number 和 value_text`)
      }
      if (
        candidate.value_number !== null
        && (typeof candidate.value_number !== 'number' || !Number.isFinite(candidate.value_number))
      ) {
        invalidRequest(`items[${index}].value_number 必须是有限数值或 null`)
      }
      if (candidate.value_text !== null && typeof candidate.value_text !== 'string') {
        invalidRequest(`items[${index}].value_text 必须是字符串或 null`)
      }

      const tuple = `${revisionId}\u0000${parameterId}`
      if (seen.has(tuple)) {
        throw new InspectionDomainError('DUPLICATE_MEASUREMENT', '同一检测记录内存在重复测量组合')
      }
      seen.add(tuple)

      return {
        part_revision_id: revisionId,
        param_item_id: parameterId,
        value_number: candidate.value_number as number | null,
        value_text: candidate.value_text,
      }
    })

    return {
      success: true,
      data: {
        record: {
          equipment_id: equipmentId,
          inspection_date: parsedTimestamp.normalized,
          ...(batchNo !== undefined ? { batch_no: batchNo } : {}),
          ...(remark !== undefined ? { remark } : {}),
        },
        items,
      },
    }
  } catch (error) {
    if (error instanceof InspectionDomainError) return validationFailure(error)
    throw error
  }
}
