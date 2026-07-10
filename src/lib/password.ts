/** 密码策略：至少 8 位，且包含四类字符中的至少三类。 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return '密码至少需要 8 位'

  const categories = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  return categories >= 3 ? null : '密码需至少包含大小写字母、数字、特殊字符中的三类'
}
