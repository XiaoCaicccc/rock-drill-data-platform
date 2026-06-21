'use client'

import { useMemo, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'

// ============================
// Types
// ============================

export interface PartRow {
  id: string
  code: string
  name: string
  category_code: string
  category_name: string
}

export interface ParamColumn {
  id: string
  param_name: string
  param_code: string
  unit: string | null
  data_type: string
  standard_min: number | null
  standard_max: number | null
  optimal_min: number | null
  optimal_max: number | null
  category_code: string
}

export interface MatrixTableProps {
  parts: PartRow[]
  paramColumns: ParamColumn[]
  cellValues: Record<string, string>
  onCellChange: (partId: string, paramItemId: string, value: string) => void
  formKey: number
  disabled?: boolean
}

// ============================
// Cell key helpers
// ============================

const CELL_SEP = '::'

export function buildCellKey(partId: string, paramItemId: string) {
  return `${partId}${CELL_SEP}${paramItemId}`
}

export function parseCellKey(key: string): {
  partId: string
  paramItemId: string
} {
  const idx = key.indexOf(CELL_SEP)
  return {
    partId: key.slice(0, idx),
    paramItemId: key.slice(idx + CELL_SEP.length),
  }
}

// ============================
// Validation helper
// ============================

function checkOutOfRange(value: string, param: ParamColumn): boolean {
  if (!value.trim()) return false
  if (param.data_type !== 'number') return false
  const num = parseFloat(value)
  if (isNaN(num)) return false
  if (param.standard_min != null && num < param.standard_min) return true
  if (param.standard_max != null && num > param.standard_max) return true
  return false
}

// ============================
// MatrixTable Component
// ============================

export function MatrixTable({
  parts,
  paramColumns,
  cellValues,
  onCellChange,
  formKey,
  disabled = false,
}: MatrixTableProps) {
  // Map: category_code -> param item IDs
  const catParamMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const pc of paramColumns) {
      if (!map[pc.category_code]) map[pc.category_code] = []
      map[pc.category_code].push(pc.id)
    }
    return map
  }, [paramColumns])

  // Map: partId -> Set<paramItemId>
  const partParamSet = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const part of parts) {
      map[part.id] = new Set(catParamMap[part.category_code] || [])
    }
    return map
  }, [parts, catParamMap])

  // Refs for frequently-changing props (avoids column re-creation)
  const cellValuesRef = useRef(cellValues)
  cellValuesRef.current = cellValues
  const onCellChangeRef = useRef(onCellChange)
  onCellChangeRef.current = onCellChange
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  // Column definitions — only rebuilt when paramColumns / partParamSet / formKey change
  const columns = useMemo<ColumnDef<PartRow>[]>(() => {
    const pinned: ColumnDef<PartRow>[] = [
      {
        id: 'code',
        header: '零件编号',
        accessorKey: 'code',
        size: 110,
      },
      {
        id: 'name',
        header: '零件名称',
        accessorKey: 'name',
        size: 140,
      },
    ]

    const paramCols: ColumnDef<PartRow>[] = paramColumns.map((pc) => ({
      id: pc.id,
      size: 110,
      header: () => (
        <div className="flex flex-col items-center gap-0.5 px-0.5">
          <span
            className="max-w-[100px] truncate text-xs font-medium leading-tight"
            title={pc.param_name}
          >
            {pc.param_name}
          </span>
          {pc.unit && (
            <span className="truncate text-[10px] leading-tight text-muted-foreground">
              ({pc.unit})
            </span>
          )}
          <span className="truncate text-[9px] leading-tight text-muted-foreground/40">
            {pc.category_code}
          </span>
        </div>
      ),
      cell: ({ row }) => {
        const part = row.original
        const cellKey = buildCellKey(part.id, pc.id)
        const isApplicable = partParamSet[part.id]?.has(pc.id)
        const committedValue = cellValuesRef.current[cellKey] || ''
        const outOfRange = checkOutOfRange(committedValue, pc)
        const isDisabled = disabledRef.current || !isApplicable

        if (!isApplicable) {
          return (
            <div className="flex h-8 items-center justify-center text-muted-foreground/25 select-none">
              —
            </div>
          )
        }

        return (
          <input
            key={`${cellKey}-${formKey}`}
            type={pc.data_type === 'number' ? 'number' : 'text'}
            defaultValue={committedValue}
            onBlur={(e) =>
              onCellChangeRef.current(part.id, pc.id, e.target.value)
            }
            disabled={isDisabled}
            step="any"
            className={cn(
              'h-8 w-full rounded border px-1.5 text-sm transition-colors',
              'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
              pc.data_type === 'number' && 'text-right tabular-nums',
              'disabled:cursor-not-allowed disabled:bg-muted/30 disabled:opacity-40',
              outOfRange && 'border-red-400 ring-1 ring-red-400 bg-red-50/50',
            )}
          />
        )
      },
    }))

    return [...pinned, ...paramCols]
  }, [paramColumns, partParamSet, formKey])

  const table = useReactTable({
    data: parts,
    columns,
    state: { columnPinning: { left: ['code', 'name'] } },
    getCoreRowModel: getCoreRowModel(),
  })

  // ============================
  // Render
  // ============================

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table
        className="border-collapse"
        style={{ minWidth: table.getTotalSize() }}
        role="grid"
        aria-label="检测数据矩阵表格"
      >
        {/* ====== Header ====== */}
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const pinned = header.column.getIsPinned()
                return (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      position: pinned ? 'sticky' : undefined,
                      left:
                        pinned === 'left'
                          ? `${header.column.getStart('left')}px`
                          : undefined,
                      right:
                        pinned === 'right'
                          ? `${header.column.getStart('right')}px`
                          : undefined,
                      zIndex: pinned ? 30 : 10,
                    }}
                    className={cn(
                      'border-b bg-muted px-2 py-2 text-xs font-medium text-muted-foreground',
                      pinned && 'bg-muted/95 backdrop-blur-sm',
                    )}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>

        {/* ====== Body ====== */}
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30 transition-colors">
              {row.getVisibleCells().map((cell) => {
                const pinned = cell.column.getIsPinned()
                const isEdgePinned =
                  pinned === 'left' && cell.column.id === 'name'
                return (
                  <td
                    key={cell.id}
                    style={{
                      width: cell.column.getSize(),
                      minWidth: cell.column.getSize(),
                      position: pinned ? 'sticky' : undefined,
                      left:
                        pinned === 'left'
                          ? `${cell.column.getStart('left')}px`
                          : undefined,
                      right:
                        pinned === 'right'
                          ? `${cell.column.getStart('right')}px`
                          : undefined,
                      zIndex: pinned ? 20 : undefined,
                    }}
                    className={cn(
                      'border-b px-1 py-0.5',
                      pinned && 'bg-background',
                      isEdgePinned &&
                        'shadow-[3px_0_6px_-3px_rgba(0,0,0,0.1)]',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}