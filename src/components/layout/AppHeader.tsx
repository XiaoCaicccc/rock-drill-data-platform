'use client'

import { MobileMenuTrigger } from '@/components/layout/AppSidebar'
import { useAppStore } from '@/store'
import { getViewLabel } from '@/components/layout/NavItems'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function AppHeader() {
  const currentView = useAppStore((s) => s.currentView)

  const today = format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full items-center gap-3 px-4 md:px-6">
        {/* 移动端菜单按钮 */}
        <MobileMenuTrigger />

        {/* 当前模块标题 */}
        <h1 className="text-base font-semibold tracking-tight">
          {getViewLabel(currentView)}
        </h1>

        {/* 右侧区域 */}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-3.5 hidden sm:block" />
          <span className="hidden sm:inline">{today}</span>
        </div>
      </div>
    </header>
  )
}