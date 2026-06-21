'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Layers,
  Puzzle,
  ClipboardList,
  ChevronRight,
  Loader2,
  FileText,
  Hash,
  Ruler,
  ArrowUpDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterBar, type FilterItem } from '@/components/common/FilterBar'
import { EmptyState } from '@/components/common/EmptyState'
import { StatCard } from '@/components/common/StatCard'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

interface TemplateItem {
  id: string
  param_name: string
  param_code: string
  unit: string | null
  data_type: string
  standard_min: number | null
  standard_max: number | null
  optimal_min: number | null
  optimal_max: number | null
  sort_order: number
}

interface Template {
  id: string
  name: string
  version: number
  items: TemplateItem[]
}

interface Category {
  id: string
  name: string
  code: string
  description: string | null
  standard_param_count: number
  part_count: number
  template: Template | null
}

// ============================
// Constants
// ============================

const FILTER_CONFIG: FilterItem[] = [
  {
    key: 'keyword',
    label: '关键词',
    type: 'input',
    placeholder: '搜索名称、编码…',
  },
]

// ============================
// Component
// ============================

export default function CategoryManager() {
  // ---- state ----
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // ---- fetch ----
  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/categories')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) setCategories(json.categories ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '未知错误')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  // ---- filtered list ----
  const filtered = useMemo(() => {
    const kw = filters.keyword?.trim().toLowerCase() ?? ''
    if (!kw) return categories
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.code.toLowerCase().includes(kw) ||
        (c.description ?? '').toLowerCase().includes(kw),
    )
  }, [categories, filters])

  // ---- stats ----
  const stats = useMemo(() => {
    const totalParts = categories.reduce((s, c) => s + c.part_count, 0)
    const totalParams = categories.reduce(
      (s, c) => s + (c.template?.items.length ?? 0),
      0,
    )
    const categoriesWithTemplate = categories.filter((c) => c.template !== null).length
    return { totalParts, totalParams, categoriesWithTemplate }
  }, [categories])

  // ---- handlers ----
  const handleSearch = useCallback((values: Record<string, string>) => {
    setFilters(values)
  }, [])

  const handleReset = useCallback(() => {
    setFilters({})
  }, [])

  const handleRowClick = useCallback((category: Category) => {
    setSelectedCategory(category)
    setDialogOpen(true)
  }, [])

  // ---- loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ---- error state ----
  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="零件类别管理" description="管理凿岩机零件分类及其参数模板" />
        <EmptyState
          icon={Layers}
          title="数据加载失败"
          description={`请求出错：${error}，请稍后重试。`}
          action={{ label: '重新加载', onClick: () => window.location.reload() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ====== Page Header ====== */}
      <PageHeader
        title="零件类别管理"
        description="管理凿岩机零件分类及其检测参数模板"
      />

      {/* ====== Stat Cards ====== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="类别总数"
          value={categories.length}
          icon={Layers}
          description="已注册的零件类别"
        />
        <StatCard
          title="关联零件"
          value={stats.totalParts}
          icon={Puzzle}
          description="各类别零件数量合计"
        />
        <StatCard
          title="参数项总数"
          value={stats.totalParams}
          icon={ClipboardList}
          description="全部模板参数项合计"
        />
        <StatCard
          title="已配置模板"
          value={stats.categoriesWithTemplate}
          icon={FileText}
          description={`共 ${categories.length} 个类别`}
        />
      </div>

      {/* ====== Filter Bar ====== */}
      <FilterBar
        filters={FILTER_CONFIG}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* ====== Category Table ====== */}
      {categories.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="暂无零件类别"
          description="请先执行种子数据初始化，或联系管理员添加类别数据。"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="未找到匹配结果"
          description="请尝试更换关键词后重新搜索。"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 pl-4">序号</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      类别编码
                    </span>
                  </TableHead>
                  <TableHead>类别名称</TableHead>
                  <TableHead className="hidden md:table-cell">描述</TableHead>
                  <TableHead className="text-center">关联零件</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">标准参数数</TableHead>
                  <TableHead className="text-center hidden lg:table-cell">模板参数项</TableHead>
                  <TableHead className="text-center">模板版本</TableHead>
                  <TableHead className="w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cat, idx) => (
                  <TableRow
                    key={cat.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(cat)}
                  >
                    <TableCell className="pl-4 text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {cat.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate text-muted-foreground md:table-cell">
                      {cat.description ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold',
                          cat.part_count > 0
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {cat.part_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {cat.standard_param_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold',
                          cat.template
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {cat.template ? cat.template.items.length : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {cat.template ? (
                        <Badge variant="secondary" className="text-xs">
                          v{cat.template.version}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ====== Template Detail Dialog ====== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-3xl">
          {selectedCategory && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedCategory.name}
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedCategory.code}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedCategory.description
                    ? selectedCategory.description
                    : '暂无描述'}
                  {selectedCategory.template && (
                    <span className="ml-2">
                      · 关联零件 {selectedCategory.part_count} 件
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {selectedCategory.template ? (
                <div className="space-y-3">
                  {/* Template info bar */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {selectedCategory.template.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      v{selectedCategory.template.version}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      共 {selectedCategory.template.items.length} 项参数
                    </span>
                  </div>

                  {/* Items table */}
                  <ScrollArea className="max-h-[50vh]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12">序号</TableHead>
                          <TableHead>参数名称</TableHead>
                          <TableHead className="font-mono text-xs">编码</TableHead>
                          <TableHead className="text-center">类型</TableHead>
                          <TableHead className="text-center">单位</TableHead>
                          <TableHead className="text-center">
                            <span className="inline-flex items-center gap-1">
                              <Ruler className="h-3 w-3" />
                              标准范围
                            </span>
                          </TableHead>
                          <TableHead className="text-center">
                            <span className="inline-flex items-center gap-1">
                              <ArrowUpDown className="h-3 w-3" />
                              最优范围
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCategory.template.items.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.param_name}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {item.param_code}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  item.data_type === 'number'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700',
                                )}
                              >
                                {item.data_type === 'number' ? '数值' : '文本'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {item.unit ?? '—'}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {item.standard_min !== null && item.standard_max !== null ? (
                                <span className="font-mono">
                                  {item.standard_min} ~ {item.standard_max}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-xs">
                              {item.optimal_min !== null && item.optimal_max !== null ? (
                                <span className="font-mono font-medium text-emerald-600">
                                  {item.optimal_min} ~ {item.optimal_max}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="该类别暂无参数模板"
                  description={`${selectedCategory.name}（${selectedCategory.code}）尚未配置检测参数模板，请先在"检测参数模板"模块中创建。`}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}