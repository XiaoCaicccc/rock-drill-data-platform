import type { BatchInspectionErrorCode } from '@/lib/inspection-errors'

export const BATCH_ERROR_MESSAGES: Record<BatchInspectionErrorCode, string> = {
  INVALID_REQUEST: '提交内容格式不正确，请检查后重试。',
  FORBIDDEN_FIELD: '提交内容包含不允许的字段，请刷新页面后重试。',
  EMPTY_BATCH: '请至少填写一项检测数据。',
  BATCH_TOO_LARGE: '单次最多提交 500 项检测数据，请分批提交。',
  UNAUTHENTICATED: '登录状态已失效，请重新登录。',
  FORBIDDEN: '当前账号无权执行检测操作。',
  RESOURCE_NOT_FOUND: '检测对象不存在或当前账号无权限访问。',
  REVISION_NOT_RELEASED: '选择的零件版本尚未发布，无法进行检测。',
  INSTALLATION_NOT_ELIGIBLE: '该零件版本在当前检测时间点未安装，请重新选择装配版本。',
  PARAMETER_CATEGORY_MISMATCH: '当前参数不属于该零件类别，请重新选择参数。',
  DUPLICATE_MEASUREMENT: '同一检测记录中存在重复参数，请检查录入数据。',
  CONCURRENT_MODIFICATION: '数据发生并发变化，请刷新后重新提交。',
  INTERNAL_ERROR: '系统异常，请稍后重试。',
}

export function getBatchErrorMessage(code: unknown): string {
  if (typeof code === 'string' && code in BATCH_ERROR_MESSAGES) {
    return BATCH_ERROR_MESSAGES[code as BatchInspectionErrorCode]
  }
  return BATCH_ERROR_MESSAGES.INTERNAL_ERROR
}

export async function getBatchErrorMessageFromResponse(
  response: Pick<Response, 'json'>,
): Promise<string> {
  try {
    const body = await response.json() as { code?: unknown }
    return getBatchErrorMessage(body?.code)
  } catch {
    return BATCH_ERROR_MESSAGES.INTERNAL_ERROR
  }
}
