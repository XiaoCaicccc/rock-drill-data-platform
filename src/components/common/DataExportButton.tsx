import { Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface DataExportButtonProps {
  onClick: () => void
  loading?: boolean
  label?: string
  className?: string
}

export function DataExportButton({ onClick, loading, label = '导出', className }: DataExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={cn('h-8 gap-1.5', className)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading ? '导出中...' : label}
    </Button>
  )
}