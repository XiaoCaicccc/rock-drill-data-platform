import { getViewLabel } from '@/components/layout/NavItems'
import type { ViewType } from '@/store'

interface PlaceholderProps {
  viewKey: ViewType
  icon: React.ReactNode
  description: string
}

export function PlaceholderView({ viewKey, icon, description }: PlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">{getViewLabel(viewKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
    </div>
  )
}