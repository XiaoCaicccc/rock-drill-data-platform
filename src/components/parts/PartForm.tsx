'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ============================
// Types
// ============================

export interface PartFormData {
  code: string
  name: string
  category_id: string
  specification: string
  material: string
  supplier: string
  equipment_id: string
  install_date: string
  working_hours: string
  status: string
  remark: string
}

export interface PartPayload {
  code: string
  name: string
  category_id: string
  specification: string | null
  material: string | null
  supplier: string | null
  equipment_id: string | null
  install_date: string | null
  working_hours: number
  status: string
  remark: string | null
}

interface CategoryOption {
  id: string
  name: string
  code: string
}

interface EquipmentOption {
  id: string
  machine_no: string
  model: string
}

interface PartFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData: {
    id: string
    code: string
    name: string
    category_id: string
    specification: string | null
    material: string | null
    supplier: string | null
    equipment_id: string | null
    install_date: string | null
    working_hours: number
    status: string
    remark: string | null
  } | null
  onSubmit: (data: PartPayload & { id?: string }) => Promise<void>
}

const STATUS_OPTIONS = [
  { label: '在用', value: '在用' },
  { label: '维修中', value: '维修中' },
  { label: '退役', value: '退役' },
  { label: '库存', value: '库存' },
]

const EMPTY_FORM: PartFormData = {
  code: '',
  name: '',
  category_id: '',
  specification: '',
  material: '',
  supplier: '',
  equipment_id: '',
  install_date: '',
  working_hours: '0',
  status: '在用',
  remark: '',
}

// ============================
// Component
// ============================

export function PartForm({ open, onOpenChange, editData, onSubmit }: PartFormProps) {
  const [form, setForm] = useState<PartFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dropdown data
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])

  const isEdit = editData !== null

  // Fetch categories & equipment for dropdowns
  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function fetchOptions() {
      try {
        const [catRes, eqRes] = await Promise.all([
          fetch('/api/categories').then((r) => r.json()),
          fetch('/api/equipment').then((r) => r.json()),
        ])
        if (!cancelled) {
          setCategories((catRes.categories ?? []).map((c: { id: string; name: string; code: string }) => ({
            id: c.id,
            name: c.name,
            code: c.code,
          })))
          setEquipmentList((eqRes.equipment ?? []).map((e: { id: string; machine_no: string; model: string }) => ({
            id: e.id,
            machine_no: e.machine_no,
            model: e.model,
          })))
        }
      } catch {
        // silently fail — dropdowns will be empty
      }
    }

    fetchOptions()
    return () => { cancelled = true }
  }, [open])

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          code: editData.code,
          name: editData.name,
          category_id: editData.category_id,
          specification: editData.specification ?? '',
          material: editData.material ?? '',
          supplier: editData.supplier ?? '',
          equipment_id: editData.equipment_id ?? '',
          install_date: editData.install_date ?? '',
          working_hours: String(editData.working_hours),
          status: editData.status,
          remark: editData.remark ?? '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setError(null)
    }
  }, [open, editData])

  const handleChange = useCallback(
    (field: keyof PartFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setError(null)
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    if (!form.code.trim()) {
      setError('零件编号不能为空')
      return
    }
    if (!form.name.trim()) {
      setError('零件名称不能为空')
      return
    }
    if (!form.category_id) {
      setError('请选择零件类别')
      return
    }

    const payload: PartPayload & { id?: string } = {
      code: form.code.trim(),
      name: form.name.trim(),
      category_id: form.category_id,
      specification: form.specification.trim() || null,
      material: form.material.trim() || null,
      supplier: form.supplier.trim() || null,
      equipment_id: form.equipment_id || null,
      install_date: form.install_date || null,
      working_hours: parseFloat(form.working_hours) || 0,
      status: form.status,
      remark: form.remark.trim() || null,
    }

    if (isEdit && editData) {
      payload.id = editData.id
    }

    try {
      setSubmitting(true)
      await onSubmit(payload)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }, [form, isEdit, editData, onSubmit, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑零件' : '新建零件'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改零件档案信息' : '填写零件信息以创建新的零件档案（一件一档）'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Row 1: code + name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="part-code">
                零件编号 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="part-code"
                placeholder="如 DRILL-001"
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value)}
                disabled={isEdit}
                className="font-mono text-sm"
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">编号创建后不可修改</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-name">
                零件名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="part-name"
                placeholder="如 钻头组件"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 2: category + status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                零件类别 <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => handleChange('category_id', v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="请选择类别" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{cat.code}</span>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleChange('status', v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: specification + material */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="part-spec">规格</Label>
              <Input
                id="part-spec"
                placeholder="如 115mm"
                value={form.specification}
                onChange={(e) => handleChange('specification', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-material">材质</Label>
              <Input
                id="part-material"
                placeholder="如 硬质合金"
                value={form.material}
                onChange={(e) => handleChange('material', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 4: supplier + equipment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="part-supplier">供应商</Label>
              <Input
                id="part-supplier"
                placeholder="如 山特维克"
                value={form.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>关联设备</Label>
              <Select
                value={form.equipment_id || '__none__'}
                onValueChange={(v) => handleChange('equipment_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="无关联设备" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">无关联设备</SelectItem>
                  {equipmentList.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-1.5">{eq.machine_no}</span>
                      {eq.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: install_date + working_hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="part-install-date">安装日期</Label>
              <Input
                id="part-install-date"
                type="date"
                value={form.install_date}
                onChange={(e) => handleChange('install_date', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part-hours">累计工时 (h)</Label>
              <Input
                id="part-hours"
                type="number"
                min="0"
                step="0.1"
                value={form.working_hours}
                onChange={(e) => handleChange('working_hours', e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Row 6: remark */}
          <div className="space-y-1.5">
            <Label htmlFor="part-remark">备注</Label>
            <Textarea
              id="part-remark"
              placeholder="可选，填写零件相关备注信息..."
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? '保存修改' : '创建零件'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}