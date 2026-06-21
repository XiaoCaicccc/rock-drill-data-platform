'use client'

import { useState, useCallback, useRef } from 'react'
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

export interface ParamItem {
  id?: string
  param_name: string
  param_code: string
  unit: string
  data_type: string
  standard_min: string
  standard_max: string
  optimal_min: string
  optimal_max: string
  sort_order: number
  options: string
}

export interface TemplateData {
  id: string
  category_id: string
  category_name: string
  category_code: string
  name: string
  version: number
  items: ParamItem[]
}

interface CategoryOption {
  id: string
  name: string
  code: string
  has_template: boolean
  template_id?: string
}

interface TemplateEditorProps {
  template: TemplateData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  allCategories: CategoryOption[]
  onSave: (templateId: string, name: string, version: number, items: ParamItem[]) => Promise<void>
  onCopyTo?: (sourceTemplateId: string, targetCategoryId: string, newName: string) => Promise<void>
}

const DATA_TYPE_OPTIONS = [
  { label: '数值', value: 'number' },
  { label: '文本', value: 'text' },
  { label: '布尔', value: 'boolean' },
  { label: '选项', value: 'option' },
]

function emptyItem(index: number): ParamItem {
  return {
    param_name: '',
    param_code: `P${String(index + 1).padStart(3, '0')}`,
    unit: '',
    data_type: 'number',
    standard_min: '',
    standard_max: '',
    optimal_min: '',
    optimal_max: '',
    sort_order: index,
    options: '',
  }
}

// ============================
// Component
// ============================

export function TemplateEditor({
  template,
  open,
  onOpenChange,
  allCategories,
  onSave,
  onCopyTo,
}: TemplateEditorProps) {
  // Local editing state
  const [items, setItems] = useState<ParamItem[]>([])
  const [templateName, setTemplateName] = useState('')
  const [templateVersion, setTemplateVersion] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTargetId, setCopyTargetId] = useState('')
  const [copyName, setCopyName] = useState('')
  const [copying, setCopying] = useState(false)

  // Drag state
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const dragCounter = useRef(0)

  // Populate on open
  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen && template) {
        setItems(
          template.items.map((item, idx) => ({
            ...item,
            standard_min: item.standard_min != null ? String(item.standard_min) : '',
            standard_max: item.standard_max != null ? String(item.standard_max) : '',
            optimal_min: item.optimal_min != null ? String(item.optimal_min) : '',
            optimal_max: item.optimal_max != null ? String(item.optimal_max) : '',
            unit: item.unit ?? '',
            options: item.options ?? '',
            sort_order: idx,
          })),
        )
        setTemplateName(template.name)
        setTemplateVersion(template.version)
        setError(null)
      }
      onOpenChange(isOpen)
    },
    [template, onOpenChange],
  )

  // ---- Item manipulation ----
  const updateItem = useCallback((index: number, field: keyof ParamItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    )
    setError(null)
  }, [])

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem(prev.length)])
  }, [])

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const moveItem = useCallback((from: number, to: number) => {
    setItems((prev) => {
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return arr.map((item, idx) => ({ ...item, sort_order: idx }))
    })
  }, [])

  // ---- Drag handlers ----
  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index
    dragCounter.current = 0
  }, [])

  const handleDragEnter = useCallback((index: number) => {
    dragCounter.current++
    dragOverItem.current = index
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounter.current--
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      moveItem(dragItem.current, dragOverItem.current)
    }
    dragItem.current = null
    dragOverItem.current = null
    dragCounter.current = 0
  }, [moveItem])

  const handleDrop = useCallback(() => {
    dragItem.current = null
    dragOverItem.current = null
    dragCounter.current = 0
  }, [])

  // ---- Save ----
  const handleSave = useCallback(async () => {
    if (!template) return
    if (!templateName.trim()) {
      setError('模板名称不能为空')
      return
    }
    // Validate items
    for (let i = 0; i < items.length; i++) {
      if (!items[i].param_name.trim()) {
        setError(`第 ${i + 1} 项参数名称不能为空`)
        return
      }
    }

    try {
      setSaving(true)
      await onSave(template.id, templateName.trim(), templateVersion, items)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }, [template, templateName, templateVersion, items, onSave, onOpenChange])

  // ---- Copy ----
  const openCopyDialog = useCallback(() => {
    if (!template) return
    setCopyName(`${template.name}（副本）`)
    setCopyTargetId('')
    setCopyOpen(true)
  }, [template])

  const handleCopy = useCallback(async () => {
    if (!template || !copyTargetId || !onCopyTo) return
    try {
      setCopying(true)
      await onCopyTo(template.id, copyTargetId, copyName.trim())
      setCopyOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制失败')
    } finally {
      setCopying(false)
    }
  }, [template, copyTargetId, copyName, onCopyTo])

  const copyTargets = allCategories.filter(
    (c) => !c.has_template || c.id === template?.category_id,
  )

  const isNumberType = (item: ParamItem) => item.data_type === 'number'

  if (!template) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-h-[92vh] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {template.category_code}
              </Badge>
              模板编辑器
            </DialogTitle>
            <DialogDescription>
              {template.category_name} — 编辑检测参数项配置
            </DialogDescription>
          </DialogHeader>

          {/* Template metadata */}
          <div className="flex items-end gap-4 rounded-lg border bg-muted/30 p-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">模板名称</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="w-24 space-y-1.5">
              <Label className="text-xs">版本号</Label>
              <Input
                type="number"
                min={1}
                value={templateVersion}
                onChange={(e) => setTemplateVersion(parseInt(e.target.value) || 1)}
                className="h-8 text-sm font-mono"
              />
            </div>
            {onCopyTo && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={openCopyDialog}
              >
                <Copy className="h-3.5 w-3.5" />
                复制模板
              </Button>
            )}
          </div>

          {/* Items table */}
          <ScrollArea className="max-h-[55vh]">
            <div className="min-w-[800px]">
              {/* Header row */}
              <div className="grid gap-2 border-b pb-2 text-xs font-medium text-muted-foreground"
                style={{ gridTemplateColumns: '40px 56px 2fr 80px 90px 80px 80px 80px 80px 80px 32px' }}
              >
                <span className="text-center">#</span>
                <span>编码</span>
                <span>参数名称</span>
                <span>类型</span>
                <span>单位</span>
                <span className="text-center">标准下限</span>
                <span className="text-center">标准上限</span>
                <span className="text-center">最优下限</span>
                <span className="text-center">最优上限</span>
                <span>选项值</span>
                <span />
              </div>

              {/* Item rows */}
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'grid gap-2 border-b py-1.5 text-sm transition-colors',
                    'hover:bg-muted/50',
                    'cursor-grab active:cursor-grabbing',
                  )}
                  style={{ gridTemplateColumns: '40px 56px 2fr 80px 90px 80px 80px 80px 80px 80px 32px' }}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {/* Drag handle + index */}
                  <div className="flex items-center justify-center gap-0.5 text-muted-foreground">
                    <GripVertical className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">{idx + 1}</span>
                  </div>

                  {/* param_code */}
                  <Input
                    value={item.param_code}
                    onChange={(e) => updateItem(idx, 'param_code', e.target.value)}
                    className="h-7 text-xs font-mono"
                    placeholder="P001"
                  />

                  {/* param_name */}
                  <Input
                    value={item.param_name}
                    onChange={(e) => updateItem(idx, 'param_name', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="参数名称"
                  />

                  {/* data_type */}
                  <Select
                    value={item.data_type}
                    onValueChange={(v) => updateItem(idx, 'data_type', v)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* unit */}
                  <Input
                    value={item.unit}
                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="mm"
                    disabled={!isNumberType(item)}
                  />

                  {/* standard_min/max */}
                  <Input
                    type="number"
                    step="any"
                    value={item.standard_min}
                    onChange={(e) => updateItem(idx, 'standard_min', e.target.value)}
                    className="h-7 text-xs font-mono text-center"
                    placeholder="min"
                    disabled={!isNumberType(item)}
                  />
                  <Input
                    type="number"
                    step="any"
                    value={item.standard_max}
                    onChange={(e) => updateItem(idx, 'standard_max', e.target.value)}
                    className="h-7 text-xs font-mono text-center"
                    placeholder="max"
                    disabled={!isNumberType(item)}
                  />

                  {/* optimal_min/max */}
                  <Input
                    type="number"
                    step="any"
                    value={item.optimal_min}
                    onChange={(e) => updateItem(idx, 'optimal_min', e.target.value)}
                    className="h-7 text-xs font-mono text-center"
                    placeholder="min"
                    disabled={!isNumberType(item)}
                  />
                  <Input
                    type="number"
                    step="any"
                    value={item.optimal_max}
                    onChange={(e) => updateItem(idx, 'optimal_max', e.target.value)}
                    className="h-7 text-xs font-mono text-center"
                    placeholder="max"
                    disabled={!isNumberType(item)}
                  />

                  {/* options (for option type) */}
                  <Input
                    value={item.options}
                    onChange={(e) => updateItem(idx, 'options', e.target.value)}
                    className="h-7 text-xs"
                    placeholder="a,b,c"
                    disabled={item.data_type !== 'option'}
                  />

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 gap-1" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                添加参数项
              </Button>
              <span className="text-xs text-muted-foreground">
                共 {items.length} 项（可拖拽排序）
              </span>
            </div>

            <div className="flex items-center gap-2">
              {error && (
                <span className="text-xs font-medium text-destructive">{error}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpen(false)}
                disabled={saving}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                保存模板
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Copy Template Dialog ====== */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>复制模板到其他类别</DialogTitle>
            <DialogDescription>
              将当前模板的所有参数项复制到目标类别，目标类别必须尚无模板。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>目标类别</Label>
              <Select value={copyTargetId} onValueChange={setCopyTargetId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="请选择目标类别" />
                </SelectTrigger>
                <SelectContent>
                  {copyTargets
                    .filter((c) => c.id !== template?.category_id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="font-mono text-xs mr-1.5">{cat.code}</span>
                        {cat.name}
                        {cat.has_template && (
                          <span className="ml-2 text-xs text-destructive">（已有模板）</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>新模板名称</Label>
              <Input
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copying}>
              取消
            </Button>
            <Button
              onClick={handleCopy}
              disabled={copying || !copyTargetId}
              className="gap-1.5"
            >
              {copying && <Loader2 className="h-4 w-4 animate-spin" />}
              确认复制
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}