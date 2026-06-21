'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus, CheckCircle } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'

interface Part {
  id: string
  code: string
  name: string
  category: { id: string; name: string; code: string }
}

interface RecentRecord {
  id: string
  recordNo: string
  part: { id: string; name: string; code: string; category: { name: string } }
  batchNo: string | null
  inspector: string
  inspectionDate: string
  result: string
}

interface FormData {
  partId: string
  batchNo: string
  inspector: string
  inspectionDate: string
  hardness: string
  dimensionA: string
  dimensionB: string
  weight: string
  surfaceQuality: string
  innerDefect: string
  result: string
  remark: string
}

const initialFormData: FormData = {
  partId: '',
  batchNo: '',
  inspector: '',
  inspectionDate: format(new Date(), 'yyyy-MM-dd'),
  hardness: '',
  dimensionA: '',
  dimensionB: '',
  weight: '',
  surfaceQuality: '',
  innerDefect: '',
  result: '待检',
  remark: '',
}

function getResultBadgeVariant(result: string) {
  switch (result) {
    case '合格':
      return 'default' as const
    case '不合格':
      return 'destructive' as const
    case '待复检':
      return 'secondary' as const
    case '待检':
    default:
      return 'outline' as const
  }
}

export default function InspectionEntryView() {
  const [parts, setParts] = useState<Part[]>([])
  const [partsLoading, setPartsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [recentLoading, setRecentLoading] = useState(true)

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch('/api/parts')
      if (!res.ok) throw new Error('获取零部件列表失败')
      const json = await res.json()
      setParts(json.data || [])
    } catch {
      toast.error('获取零部件列表失败')
    } finally {
      setPartsLoading(false)
    }
  }, [])

  const fetchRecentRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/inspections?pageSize=5')
      if (!res.ok) throw new Error('获取最近记录失败')
      const json = await res.json()
      setRecentRecords(json.data || [])
    } catch {
      // Silently fail for recent records
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchParts()
    fetchRecentRecords()
  }, [fetchParts, fetchRecentRecords])

  // Group parts by category
  const partsByCategory = parts.reduce<Record<string, Part[]>>((acc, part) => {
    const catName = part.category.name
    if (!acc[catName]) acc[catName] = []
    acc[catName].push(part)
    return acc
  }, {})

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.partId) {
      toast.error('请选择零部件')
      return
    }
    if (!formData.inspector.trim()) {
      toast.error('请输入检测员姓名')
      return
    }
    if (!formData.inspectionDate) {
      toast.error('请选择检测日期')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        partId: formData.partId,
        inspector: formData.inspector,
        inspectionDate: formData.inspectionDate,
        result: formData.result || '待检',
      }

      if (formData.batchNo) payload.batchNo = formData.batchNo
      if (formData.hardness) payload.hardness = parseFloat(formData.hardness)
      if (formData.dimensionA) payload.dimensionA = parseFloat(formData.dimensionA)
      if (formData.dimensionB) payload.dimensionB = parseFloat(formData.dimensionB)
      if (formData.weight) payload.weight = parseFloat(formData.weight)
      if (formData.surfaceQuality) payload.surfaceQuality = formData.surfaceQuality
      if (formData.innerDefect) payload.innerDefect = formData.innerDefect
      if (formData.remark) payload.remark = formData.remark

      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '提交失败')
      }

      toast.success('检测记录提交成功')
      setFormData(initialFormData)
      fetchRecentRecords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData(initialFormData)
  }

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            检测数据录入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Basic info - two columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Part selection */}
              <div className="space-y-2">
                <Label htmlFor="partId">
                  零部件选择 <span className="text-destructive">*</span>
                </Label>
                {partsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select
                    value={formData.partId}
                    onValueChange={(val) => updateField('partId', val)}
                  >
                    <SelectTrigger className="w-full" id="partId">
                      <SelectValue placeholder="请选择零部件" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(partsByCategory).map(([category, parts]) => (
                        <SelectGroup key={category}>
                          <SelectLabel>{category}</SelectLabel>
                          {parts.map((part) => (
                            <SelectItem key={part.id} value={part.id}>
                              {part.code} - {part.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Batch number */}
              <div className="space-y-2">
                <Label htmlFor="batchNo">批次号</Label>
                <Input
                  id="batchNo"
                  placeholder="如 PC-2025-06-01"
                  value={formData.batchNo}
                  onChange={(e) => updateField('batchNo', e.target.value)}
                />
              </div>

              {/* Inspector */}
              <div className="space-y-2">
                <Label htmlFor="inspector">
                  检测员 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inspector"
                  placeholder="输入检测员姓名"
                  value={formData.inspector}
                  onChange={(e) => updateField('inspector', e.target.value)}
                />
              </div>

              {/* Inspection date */}
              <div className="space-y-2">
                <Label htmlFor="inspectionDate">
                  检测日期 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inspectionDate"
                  type="date"
                  value={formData.inspectionDate}
                  onChange={(e) => updateField('inspectionDate', e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Metrics */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  检测指标
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hardness">硬度 HRC</Label>
                    <Input
                      id="hardness"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={formData.hardness}
                      onChange={(e) => updateField('hardness', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensionA">尺寸A mm</Label>
                    <Input
                      id="dimensionA"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.dimensionA}
                      onChange={(e) => updateField('dimensionA', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dimensionB">尺寸B mm</Label>
                    <Input
                      id="dimensionB"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.dimensionB}
                      onChange={(e) => updateField('dimensionB', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">重量 g</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={formData.weight}
                      onChange={(e) => updateField('weight', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Row 3: Quality assessment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surfaceQuality">表面质量</Label>
                <Select
                  value={formData.surfaceQuality}
                  onValueChange={(val) => updateField('surfaceQuality', val)}
                >
                  <SelectTrigger className="w-full" id="surfaceQuality">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="良好">良好</SelectItem>
                    <SelectItem value="一般">一般</SelectItem>
                    <SelectItem value="不合格">不合格</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="innerDefect">内部缺陷</Label>
                <Select
                  value={formData.innerDefect}
                  onValueChange={(val) => updateField('innerDefect', val)}
                >
                  <SelectTrigger className="w-full" id="innerDefect">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="无">无</SelectItem>
                    <SelectItem value="轻微">轻微</SelectItem>
                    <SelectItem value="严重">严重</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="result">检测结果</Label>
                <Select
                  value={formData.result}
                  onValueChange={(val) => updateField('result', val)}
                >
                  <SelectTrigger className="w-full" id="result">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="待检">待检</SelectItem>
                    <SelectItem value="合格">合格</SelectItem>
                    <SelectItem value="不合格">不合格</SelectItem>
                    <SelectItem value="待复检">待复检</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 4: Remark */}
            <div className="space-y-2">
              <Label htmlFor="remark">备注</Label>
              <Textarea
                id="remark"
                rows={2}
                placeholder="可选，填写备注信息"
                value={formData.remark}
                onChange={(e) => updateField('remark', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={handleReset}>
                重置
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : '提交记录'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5" />
            最近提交记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              暂无提交记录
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">检测编号</TableHead>
                    <TableHead>零部件</TableHead>
                    <TableHead className="hidden sm:table-cell">类别</TableHead>
                    <TableHead className="hidden sm:table-cell">批次号</TableHead>
                    <TableHead>检测员</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">
                        {record.recordNo}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.part.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {record.part.category?.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {record.batchNo || '-'}
                      </TableCell>
                      <TableCell>{record.inspector}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(record.inspectionDate), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getResultBadgeVariant(record.result)}>
                          {record.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
