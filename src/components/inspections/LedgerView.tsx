'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Search, Download, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Category {
  id: string
  name: string
  code: string
  _count: { parts: number }
}

interface InspectionRecord {
  id: string
  recordNo: string
  part: {
    id: string
    name: string
    code: string
    category: { id: string; name: string; code: string }
  }
  batchNo: string | null
  inspector: string
  inspectionDate: string
  hardness: number | null
  dimensionA: number | null
  dimensionB: number | null
  weight: number | null
  surfaceQuality: string | null
  innerDefect: string | null
  result: string
  remark: string | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface FilterState {
  search: string
  categoryId: string
  result: string
  startDate: string
  endDate: string
}

const PAGE_SIZE = 15

const initialFilters: FilterState = {
  search: '',
  categoryId: '',
  result: '',
  startDate: '',
  endDate: '',
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

export default function LedgerView() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [records, setRecords] = useState<InspectionRecord[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialFilters)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        if (!res.ok) throw new Error('获取类别失败')
        const json = await res.json()
        setCategories(json.data || [])
      } catch {
        toast.error('获取类别列表失败')
      } finally {
        setCategoriesLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // Fetch records when appliedFilters or page changes
  const fetchRecords = useCallback(async (page: number = 1, currentFilters: FilterState = appliedFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      if (currentFilters.search) params.set('search', currentFilters.search)
      if (currentFilters.categoryId) params.set('categoryId', currentFilters.categoryId)
      if (currentFilters.result) params.set('result', currentFilters.result)
      if (currentFilters.startDate) params.set('startDate', currentFilters.startDate)
      if (currentFilters.endDate) params.set('endDate', currentFilters.endDate)

      const res = await fetch(`/api/inspections?${params.toString()}`)
      if (!res.ok) throw new Error('获取记录失败')
      const json = await res.json()
      setRecords(json.data || [])
      setPagination(json.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 })
    } catch {
      toast.error('获取检测记录失败')
    } finally {
      setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    fetchRecords(1)
  }, [fetchRecords])

  const handleSearch = () => {
    setAppliedFilters({ ...filters })
    fetchRecords(1, filters)
  }

  const handleReset = () => {
    setFilters(initialFilters)
    setAppliedFilters(initialFilters)
    fetchRecords(1, initialFilters)
  }

  const handlePageChange = (newPage: number) => {
    fetchRecords(newPage)
  }

  const handleExport = () => {
    window.open('/api/export?format=csv&type=inspections', '_blank')
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const res = await fetch(`/api/inspections?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '删除失败')
      }
      toast.success('记录已删除')
      fetchRecords(pagination.page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(null)
    }
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // Compute pagination display info
  const startItem = pagination.total > 0 ? (pagination.page - 1) * PAGE_SIZE + 1 : 0
  const endItem = Math.min(pagination.page * PAGE_SIZE, pagination.total)

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            检测台账查询
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter row 1: Search + Category + Result */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ledger-search">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ledger-search"
                  placeholder="编号、名称、检测员、批次"
                  className="pl-9"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch()
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-category">类别筛选</Label>
              {categoriesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={filters.categoryId}
                  onValueChange={(val) => updateFilter('categoryId', val === '__all__' ? '' : val)}
                >
                  <SelectTrigger className="w-full" id="ledger-category">
                    <SelectValue placeholder="全部类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部类别</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name} ({cat._count.parts})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-result">检测结果</Label>
              <Select
                value={filters.result}
                onValueChange={(val) => updateFilter('result', val === '__all__' ? '' : val)}
              >
                <SelectTrigger className="w-full" id="ledger-result">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  <SelectItem value="合格">合格</SelectItem>
                  <SelectItem value="不合格">不合格</SelectItem>
                  <SelectItem value="待检">待检</SelectItem>
                  <SelectItem value="待复检">待复检</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>操作</Label>
              <div className="flex gap-2">
                <Button type="button" onClick={handleSearch} size="sm">
                  <Search className="h-4 w-4 mr-1" />
                  查询
                </Button>
                <Button type="button" variant="outline" onClick={handleReset} size="sm">
                  重置
                </Button>
                <Button type="button" variant="outline" onClick={handleExport} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
              </div>
            </div>
          </div>

          {/* Filter row 2: Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ledger-start-date">起始日期</Label>
              <Input
                id="ledger-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => updateFilter('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ledger-end-date">结束日期</Label>
              <Input
                id="ledger-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => updateFilter('endDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">检测编号</TableHead>
                    <TableHead>零部件名称</TableHead>
                    <TableHead className="hidden md:table-cell">类别</TableHead>
                    <TableHead className="hidden lg:table-cell">批次号</TableHead>
                    <TableHead className="hidden sm:table-cell">检测员</TableHead>
                    <TableHead>检测日期</TableHead>
                    <TableHead className="hidden lg:table-cell">硬度</TableHead>
                    <TableHead className="hidden md:table-cell">表面质量</TableHead>
                    <TableHead>检测结果</TableHead>
                    <TableHead className="w-[80px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-24 text-center">
                        <p className="text-muted-foreground">暂无检测记录</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-xs">
                          {record.recordNo}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.part.name}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {record.part.category.name}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {record.batchNo || '-'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {record.inspector}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(record.inspectionDate), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {record.hardness != null ? record.hardness.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {record.surfaceQuality || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getResultBadgeVariant(record.result)}>
                            {record.result}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={deleting === record.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除检测记录 <span className="font-mono font-semibold">{record.recordNo}</span> 吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                  onClick={() => handleDelete(record.id)}
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!loading && pagination.total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                第 {startItem}-{endItem} 条，共 {pagination.total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
