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

export interface EquipmentFormData {
  machine_no: string
  model: string
  manufacturer: string
  production_date: string
  status: string
  current_location: string
  total_working_hours: string
  remark: string
}

export interface EquipmentPayload {
  machine_no: string
  model: string
  manufacturer: string | null
  production_date: string | null
  status: string
  current_location: string | null
  total_working_hours: number
  remark: string | null
}

interface EquipmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit mode: pass existing data; null = create mode */
  editData: {
    id: string
    machine_no: string
    model: string
    manufacturer: string | null
    production_date: string | null
    status: string
    current_location: string | null
    total_working_hours: number
    remark: string | null
  } | null
  onSubmit: (data: EquipmentPayload & { id?: string }) => Promise<void>
}

const STATUS_OPTIONS = [
  { label: '在用', value: '在用' },
  { label: '维修中', value: '维修中' },
  { label: '退役', value: '退役' },
  { label: '库存', value: '库存' },
]

const EMPTY_FORM: EquipmentFormData = {
  machine_no: '',
  model: '',
  manufacturer: '',
  production_date: '',
  status: '在用',
  current_location: '',
  total_working_hours: '0',
  remark: '',
}

// ============================
// Component
// ============================

export function EquipmentForm({ open, onOpenChange, editData, onSubmit }: EquipmentFormProps) {
  const [form, setForm] = useState<EquipmentFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = editData !== null

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          machine_no: editData.machine_no,
          model: editData.model,
          manufacturer: editData.manufacturer ?? '',
          production_date: editData.production_date ?? '',
          status: editData.status,
          current_location: editData.current_location ?? '',
          total_working_hours: String(editData.total_working_hours),
          remark: editData.remark ?? '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setError(null)
    }
  }, [open, editData])

  const handleChange = useCallback(
    (field: keyof EquipmentFormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setError(null)
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    // Validation
    if (!form.machine_no.trim()) {
      setError('机头编号不能为空')
      return
    }
    if (!form.model.trim()) {
      setError('型号不能为空')
      return
    }

    const payload: EquipmentPayload & { id?: string } = {
      machine_no: form.machine_no.trim(),
      model: form.model.trim(),
      manufacturer: form.manufacturer.trim() || null,
      production_date: form.production_date || null,
      status: form.status,
      current_location: form.current_location.trim() || null,
      total_working_hours: parseFloat(form.total_working_hours) || 0,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑设备' : '新建设备'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改设备档案信息' : '填写设备基本信息以创建新设备档案'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Row 1: machine_no + model */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="machine_no">
                机头编号 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="machine_no"
                placeholder="如 COP1838ME"
                value={form.machine_no}
                onChange={(e) => handleChange('machine_no', e.target.value)}
                disabled={isEdit}
                className="font-mono text-sm"
              />
              {isEdit && (
                <p className="text-xs text-muted-foreground">编号创建后不可修改</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">
                型号 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model"
                placeholder="如 DD422i"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 2: manufacturer + production_date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer">制造商</Label>
              <Input
                id="manufacturer"
                placeholder="如 阿特拉斯·科普柯"
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="production_date">出厂日期</Label>
              <Input
                id="production_date"
                type="date"
                value={form.production_date}
                onChange={(e) => handleChange('production_date', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 3: status + current_location */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="current_location">当前位置</Label>
              <Input
                id="current_location"
                placeholder="如 1号矿井-工作面"
                value={form.current_location}
                onChange={(e) => handleChange('current_location', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* Row 4: total_working_hours */}
          <div className="w-1/2 space-y-1.5">
            <Label htmlFor="total_working_hours">累计工时 (h)</Label>
            <Input
              id="total_working_hours"
              type="number"
              min="0"
              step="0.1"
              value={form.total_working_hours}
              onChange={(e) => handleChange('total_working_hours', e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          {/* Row 5: remark */}
          <div className="space-y-1.5">
            <Label htmlFor="remark">备注</Label>
            <Textarea
              id="remark"
              placeholder="可选，填写设备相关备注信息…"
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
              rows={3}
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
            {isEdit ? '保存修改' : '创建设备'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}