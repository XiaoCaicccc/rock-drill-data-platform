import type { Prisma } from '@prisma/client'

export type InspectionFilterValues = {
  search: string
  categoryId: string
  result: string
  startDate: string
  endDate: string
}

export type InspectionFilterError = 'invalid_date' | 'invalid_date_range' | null

function firstNonBlank(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim()
    if (normalized) return normalized
  }
  return ''
}

function parseFilterDate(value: string, endOfDay: boolean) {
  if (!value) return null
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeInspectionFilterParams(
  params: URLSearchParams,
  options: { includeLegacyDateAliases?: boolean } = {},
): InspectionFilterValues {
  return {
    search: firstNonBlank(params.get('search'), params.get('keyword')),
    categoryId: firstNonBlank(params.get('categoryId')),
    result: firstNonBlank(params.get('result'), params.get('status')),
    startDate: firstNonBlank(
      params.get('startDate'),
      options.includeLegacyDateAliases ? params.get('date_from') : undefined,
    ),
    endDate: firstNonBlank(
      params.get('endDate'),
      options.includeLegacyDateAliases ? params.get('date_to') : undefined,
    ),
  }
}

export function buildInspectionRecordFilters(filters: InspectionFilterValues): {
  where: Prisma.inspection_recordWhereInput
  error: InspectionFilterError
} {
  const start = parseFilterDate(filters.startDate, false)
  const end = parseFilterDate(filters.endDate, true)
  if ((filters.startDate && !start) || (filters.endDate && !end)) {
    return { where: {}, error: 'invalid_date' }
  }
  if (start && end && start > end) {
    return { where: {}, error: 'invalid_date_range' }
  }

  return {
    error: null,
    where: {
      ...(filters.search
        ? {
            OR: [
              { record_no: { contains: filters.search, mode: 'insensitive' } },
              { inspector: { contains: filters.search, mode: 'insensitive' } },
              { batch_no: { contains: filters.search, mode: 'insensitive' } },
              {
                data_items: {
                  some: {
                    part: {
                      OR: [
                        { name: { contains: filters.search, mode: 'insensitive' } },
                        { code: { contains: filters.search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(filters.result ? { overall_result: filters.result } : {}),
      ...(filters.categoryId
        ? {
            data_items: {
              some: { part: { category_id: filters.categoryId } },
            },
          }
        : {}),
      ...(start || end
        ? {
            inspection_date: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
    },
  }
}
