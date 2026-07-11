'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type RevisionState = 'draft' | 'reviewing' | 'released' | 'obsolete'
export type Criticality = 'normal' | 'important' | 'critical'

export interface PartRevisionSummary {
  id: string
  revision_no: string
  lifecycle_state: RevisionState
  drawing_no: string | null
  unit: string | null
  specification: string | null
  material: string | null
  supplier: string | null
  criticality: Criticality
  key_characteristics: unknown
  change_summary: string | null
  remark: string | null
}

export interface PartPayload {
  code: string
  name: string
  category_id: string
  install_date: string | null
  working_hours: number
  is_active: boolean
  drawing_no: string | null
  unit: string | null
  specification: string | null
  material: string | null
  supplier: string | null
  criticality: Criticality
  key_characteristics: Record<string, unknown> | unknown[] | null
  change_summary: string | null
  remark: string | null
  revision_id?: string
}

type EditablePart = {
  id: string
  code: string
  name: string
  category_id: string
  install_date: string | null
  working_hours: number
  is_active: boolean
  latest_revision: PartRevisionSummary | null
}

type FormState = Omit<PartPayload, 'key_characteristics' | 'revision_id'> & { key_characteristics: string }

interface PartFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData: EditablePart | null
  onSubmit: (data: PartPayload, submitForReview: boolean) => Promise<void>
}

const EMPTY_FORM: FormState = {
  code: '', name: '', category_id: '', install_date: null, working_hours: 0, is_active: true,
  drawing_no: null, unit: '件', specification: null, material: null, supplier: null, criticality: 'normal',
  key_characteristics: '', change_summary: null, remark: null,
}

export function PartForm({ open, onOpenChange, editData, onSubmit }: PartFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [categories, setCategories] = useState<{ id: string; name: string; code: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revision = editData?.latest_revision ?? null
  const isDraft = revision?.lifecycle_state === 'draft'
  const versionReadOnly = Boolean(revision && !isDraft)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/categories').then((response) => response.json())
      .then((categoryJson) => {
        if (cancelled) return
        setCategories(categoryJson.categories ?? [])
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!editData) {
      setForm(EMPTY_FORM)
    } else {
      setForm({
        code: editData.code,
        name: editData.name,
        category_id: editData.category_id,
        install_date: editData.install_date,
        working_hours: editData.working_hours,
        is_active: editData.is_active,
        drawing_no: revision?.drawing_no ?? null,
        unit: revision?.unit ?? '件',
        specification: revision?.specification ?? null,
        material: revision?.material ?? null,
        supplier: revision?.supplier ?? null,
        criticality: revision?.criticality ?? 'normal',
        key_characteristics: revision?.key_characteristics ? JSON.stringify(revision.key_characteristics, null, 2) : '',
        change_summary: revision?.change_summary ?? null,
        remark: revision?.remark ?? null,
      })
    }
    setError(null)
  }, [editData, open, revision])

  const update = useCallback((field: keyof FormState, value: FormState[keyof FormState]) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setError(null)
  }, [])

  const submit = useCallback(async (submitForReview: boolean) => {
    if (!form.code.trim() || !form.name.trim() || !form.category_id) {
      setError('请填写零件编号、名称并选择类别')
      return
    }
    let keyCharacteristics: Record<string, unknown> | unknown[] | null = null
    if (form.key_characteristics.trim()) {
      try {
        const parsed: unknown = JSON.parse(form.key_characteristics)
        if (!parsed || typeof parsed !== 'object') throw new Error()
        keyCharacteristics = parsed as Record<string, unknown> | unknown[]
      } catch {
        setError('关键特性必须是合法的 JSON 对象或数组')
        return
      }
    }
    try {
      setSubmitting(true)
      await onSubmit({
        ...form,
        code: form.code.trim(), name: form.name.trim(),
        drawing_no: form.drawing_no?.trim() || null,
        unit: form.unit?.trim() || null,
        specification: form.specification?.trim() || null,
        material: form.material?.trim() || null,
        supplier: form.supplier?.trim() || null,
        change_summary: form.change_summary?.trim() || null,
        remark: form.remark?.trim() || null,
        key_characteristics: keyCharacteristics,
        revision_id: revision?.id,
      }, submitForReview)
      onOpenChange(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }, [form, onOpenChange, onSubmit, revision?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editData ? '编辑零件主数据' : '新建零件主数据'}</DialogTitle>
          <DialogDescription>{editData ? '已发布版本的技术字段只读；如需变更请创建升版草稿。' : '创建后将生成版本号为 01 的草稿。'}</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-4">
          <p className="text-sm font-semibold">主数据</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="零件编号 *"><Input value={form.code} disabled={Boolean(editData)} onChange={(event) => update('code', event.target.value)} /></Field>
            <Field label="零件名称 *"><Input value={form.name} onChange={(event) => update('name', event.target.value)} /></Field>
            <Field label="零件类别 *"><Select value={form.category_id} onValueChange={(value) => update('category_id', value)}><SelectTrigger><SelectValue placeholder="请选择类别" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.code} {category.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="安装日期"><Input type="date" value={form.install_date ?? ''} onChange={(event) => update('install_date', event.target.value || null)} /></Field>
            <Field label="累计工时 (h)"><Input type="number" min="0" value={form.working_hours} onChange={(event) => update('working_hours', Number(event.target.value) || 0)} /></Field>
          </div>
        </section>

        <section className="mt-2 flex flex-col gap-4 rounded-lg border bg-muted/20 p-4">
          <div><p className="text-sm font-semibold">版本数据 {revision ? `· ${revision.revision_no} 版` : '· 01 版草稿'}</p><p className="text-xs text-muted-foreground">{versionReadOnly ? '当前版本已发布或已进入评审，不可编辑。' : '技术字段随版本受控。'}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="图号"><Input value={form.drawing_no ?? ''} disabled={versionReadOnly} onChange={(event) => update('drawing_no', event.target.value || null)} /></Field>
            <Field label="单位"><Input value={form.unit ?? ''} disabled={versionReadOnly} onChange={(event) => update('unit', event.target.value || null)} /></Field>
            <Field label="规格"><Input value={form.specification ?? ''} disabled={versionReadOnly} onChange={(event) => update('specification', event.target.value || null)} /></Field>
            <Field label="材质"><Input value={form.material ?? ''} disabled={versionReadOnly} onChange={(event) => update('material', event.target.value || null)} /></Field>
            <Field label="供应商"><Input value={form.supplier ?? ''} disabled={versionReadOnly} onChange={(event) => update('supplier', event.target.value || null)} /></Field>
            <Field label="关键性"><Select value={form.criticality} disabled={versionReadOnly} onValueChange={(value) => update('criticality', value as Criticality)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">一般</SelectItem><SelectItem value="important">重要</SelectItem><SelectItem value="critical">关键</SelectItem></SelectContent></Select></Field>
          </div>
          <Field label="关键特性（JSON）"><Textarea rows={3} value={form.key_characteristics} disabled={versionReadOnly} placeholder={'例如 {"尺寸":"90±1mm","需全检":true}'} onChange={(event) => update('key_characteristics', event.target.value)} /></Field>
          <Field label="变更说明"><Textarea rows={2} value={form.change_summary ?? ''} disabled={versionReadOnly} onChange={(event) => update('change_summary', event.target.value || null)} /></Field>
          <Field label="版本备注"><Textarea rows={2} value={form.remark ?? ''} disabled={versionReadOnly} onChange={(event) => update('remark', event.target.value || null)} /></Field>
        </section>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>取消</Button>
          {isDraft ? <Button variant="outline" disabled={submitting} onClick={() => submit(true)}>提交评审</Button> : null}
          <Button disabled={submitting} onClick={() => submit(false)}>{submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}{editData ? '保存主数据' : '创建零件'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label>{label}</Label>{children}</div>
}
