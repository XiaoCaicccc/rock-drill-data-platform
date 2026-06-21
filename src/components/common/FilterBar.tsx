'use client'

import { useState, useCallback } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface FilterItem {
  key: string
  label: string
  type: 'input' | 'select' | 'date'
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface FilterBarProps {
  filters: FilterItem[]
  onSearch: (values: Record<string, string>) => void
  onReset: () => void
  className?: string
}

export function FilterBar({ filters, onSearch, onReset, className }: FilterBarProps) {
  // Initialize state for each filter
  const initState: Record<string, string> = {}
  for (const f of filters) initState[f.key] = ''
  const [values, setValues] = useState<Record<string, string>>(initState)

  const handleChange = useCallback((key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSearch = useCallback(() => {
    // Only include non-empty values
    const filtered: Record<string, string> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) filtered[k] = v.trim()
    }
    onSearch(filtered)
  }, [values, onSearch])

  const handleReset = useCallback(() => {
    setValues(initState)
    onReset()
  }, [onReset])

  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4', className)}>
      {filters.map(filter => (
        <div key={filter.key} className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            {filter.label}
          </Label>

          {filter.type === 'select' && filter.options ? (
            <Select
              value={values[filter.key] || '__all__'}
              onValueChange={v => handleChange(filter.key, v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder={filter.placeholder || `请选择${filter.label}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部</SelectItem>
                {filter.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={filter.type === 'date' ? 'date' : 'text'}
              placeholder={filter.placeholder || `请输入${filter.label}`}
              value={values[filter.key]}
              onChange={e => handleChange(filter.key, e.target.value)}
              className={cn(
                'h-8 text-sm',
                filter.type === 'date' && 'w-[160px]',
                filter.type === 'input' && 'w-[180px]',
              )}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch()
              }}
            />
          )}
        </div>
      ))}

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2 pb-0.5">
        <Button size="sm" onClick={handleSearch} className="h-8 gap-1.5">
          <Search className="h-3.5 w-3.5" />
          查询
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} className="h-8 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </Button>
      </div>
    </div>
  )
}