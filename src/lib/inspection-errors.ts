export const BATCH_INSPECTION_ERROR_STATUS = {
  INVALID_REQUEST: 400,
  FORBIDDEN_FIELD: 400,
  EMPTY_BATCH: 400,
  BATCH_TOO_LARGE: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  REVISION_NOT_RELEASED: 409,
  INSTALLATION_NOT_ELIGIBLE: 409,
  PARAMETER_CATEGORY_MISMATCH: 409,
  DUPLICATE_MEASUREMENT: 409,
  CONCURRENT_MODIFICATION: 409,
  INTERNAL_ERROR: 500,
} as const

export type BatchInspectionErrorCode = keyof typeof BATCH_INSPECTION_ERROR_STATUS

export type BatchInspectionErrorBody = {
  error: string
  code: BatchInspectionErrorCode
}

export class InspectionDomainError extends Error {
  readonly code: BatchInspectionErrorCode
  readonly status: number

  constructor(code: BatchInspectionErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = BATCH_INSPECTION_ERROR_STATUS[code]
  }
}

export function toBatchInspectionErrorBody(
  error: InspectionDomainError,
): BatchInspectionErrorBody {
  return { error: error.message, code: error.code }
}
