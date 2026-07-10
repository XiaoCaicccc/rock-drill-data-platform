import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyDataScope, requireAuth, requireOwnershipOrAdmin, requireRole } from '@/lib/permissions'
import { createDownloadUrl, createUploadUrl, deleteStoredObject, documentStorageKey } from '@/lib/storage'
import { logAudit } from '@/lib/audit'

const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'dwg', 'dxf', 'jpg', 'jpeg', 'png'])
const MAX_FILE_SIZE = 50 * 1024 * 1024

function extension(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

export async function GET(request: NextRequest) {
  const access = await requireAuth()
  if (access instanceof Response) return access
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (id && searchParams.get('download') === 'true') {
    const document = await db.document.findUnique({ where: { id } })
    if (!document) return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    const ownership = await requireOwnershipOrAdmin(document.created_by)
    if (ownership instanceof Response) return ownership
    if (!document.storage_key) return NextResponse.json({ error: '该文档没有可下载的文件' }, { status: 404 })
    const url = await createDownloadUrl(document.storage_key)
    return NextResponse.json({ url, expiresIn: 300 })
  }

  const category = searchParams.get('category') || ''
  const keyword = searchParams.get('keyword') || ''
  const where = applyDataScope(access, {
    ...(category ? { category } : {}),
    ...(keyword ? { title: { contains: keyword, mode: 'insensitive' as const } } : {}),
  })
  const documents = await db.document.findMany({ where, orderBy: { created_at: 'desc' } })
  return NextResponse.json({ documents })
}

/** 第一步：校验元数据并签发 15 分钟直传 URL。 */
export async function POST(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { original_name, file_size, mime_type } = body
  if (!original_name || typeof original_name !== 'string') return NextResponse.json({ error: '缺少文件名' }, { status: 400 })
  if (!ALLOWED_EXTENSIONS.has(extension(original_name))) return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 })
  if (!Number.isInteger(file_size) || file_size < 1 || file_size > MAX_FILE_SIZE) return NextResponse.json({ error: '文件大小必须在 1B 到 50MB 之间' }, { status: 400 })
  const storageKey = documentStorageKey(access.user.id, original_name)
  const uploadUrl = await createUploadUrl(storageKey)
  return NextResponse.json({ storageKey, uploadUrl, expiresIn: 900, mimeType: mime_type || 'application/octet-stream' })
}

/** 第二步：客户端直传成功后确认文档元数据。 */
export async function PUT(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const body = await request.json()
  const { id, title, category, archived, related_report_id, storage_key, original_name, file_size, mime_type } = body

  if (!id) {
    if (!title?.trim() || !category?.trim()) return NextResponse.json({ error: '标题和类别不能为空' }, { status: 400 })
    if (storage_key && !String(storage_key).startsWith(`documents/${access.user.id}/`)) return NextResponse.json({ error: '无效的存储键' }, { status: 400 })
    const document = await db.document.create({ data: { title: title.trim(), category: category.trim(), related_report_id: related_report_id || null, storage_key: storage_key || null, original_name: original_name || null, file_size: file_size ?? null, mime_type: mime_type || null, created_by: access.user.id } })
    await logAudit({ userId: access.user.id, action: 'CREATE', entityType: 'document', entityId: document.id, after: { title: document.title, storage_key: document.storage_key }, request })
    return NextResponse.json({ document }, { status: 201 })
  }

  const existing = await db.document.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  const ownership = await requireOwnershipOrAdmin(existing.created_by)
  if (ownership instanceof Response) return ownership
  const updated = await db.document.update({ where: { id }, data: { ...(title !== undefined ? { title: title.trim() } : {}), ...(category !== undefined ? { category } : {}), ...(archived !== undefined ? { archived } : {}), ...(related_report_id !== undefined ? { related_report_id: related_report_id || null } : {}) } })
  await logAudit({ userId: access.user.id, action: 'UPDATE', entityType: 'document', entityId: id, before: { archived: existing.archived, title: existing.title }, after: { archived: updated.archived, title: updated.title }, request })
  return NextResponse.json({ document: updated })
}

export async function DELETE(request: NextRequest) {
  const access = await requireRole(['admin', 'quality_manager', 'engineer'])
  if (access instanceof Response) return access
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少文档 ID' }, { status: 400 })
  const existing = await db.document.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: '文档不存在' }, { status: 404 })
  const ownership = await requireOwnershipOrAdmin(existing.created_by)
  if (ownership instanceof Response) return ownership
  if (existing.storage_key) await deleteStoredObject(existing.storage_key)
  await db.document.delete({ where: { id } })
  await logAudit({ userId: access.user.id, action: 'DELETE', entityType: 'document', entityId: id, before: { title: existing.title, storage_key: existing.storage_key }, request })
  return NextResponse.json({ success: true })
}
