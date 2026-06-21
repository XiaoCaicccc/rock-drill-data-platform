'use client'

import { useCallback, useMemo } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAppStore } from '@/store'
import { NAV_ITEMS, type NavItem } from '@/components/layout/NavItems'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight, Menu, HardHat } from 'lucide-react'
import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────
// 导航项渲染（复用于桌面端和移动端）
// ────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavItem
  active: boolean
  expanded: boolean
  onClick: () => void
}

function SidebarNavItem({ item, active, expanded, onClick }: NavItemProps) {
  const Icon = item.icon

  // 展开状态：完整按钮
  if (expanded) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
          active
            ? 'bg-amber-500/15 text-amber-400'
            : 'text-slate-300 hover:text-white'
        )}
      >
        <Icon className="size-5 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    )
  }

  // 折叠状态：图标 + tooltip
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'flex w-full items-center justify-center rounded-md p-2.5 transition-colors',
            'hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
            active
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-slate-400 hover:text-white'
          )}
        >
          <Icon className="size-5 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

// ────────────────────────────────────────────────────────────
// 导航列表（带分组标题和分隔线）
// ────────────────────────────────────────────────────────────

interface NavListProps {
  currentView: string
  expanded: boolean
  onNavigate: (key: NavItem['key']) => void
}

function NavList({ currentView, expanded, onNavigate }: NavListProps) {
  // 按分组标识分区，group 不为 null 的项作为分组标题
  const sections = useMemo(() => {
    const result: Array<{ type: 'item'; item: NavItem } | { type: 'group'; label: string } | { type: 'separator' }> = []

    NAV_ITEMS.forEach((item, index) => {
      if (item.group !== null) {
        // 插入分组标题
        if (index > 0) result.push({ type: 'separator' })
        result.push({ type: 'group', label: item.group })
      }
      result.push({ type: 'item', item })
    })

    return result
  }, [])

  return (
    <nav className="flex flex-col gap-1 px-2">
      {sections.map((section, i) => {
        if (section.type === 'group') {
          return expanded ? (
            <p
              key={`group-${i}`}
              className="px-3 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
            >
              {section.label}
            </p>
          ) : (
            <Separator key={`group-${i}`} className="my-2 bg-white/10" />
          )
        }

        if (section.type === 'separator') {
          return <Separator key={`sep-${i}`} className="my-1 bg-white/10" />
        }

        return (
          <SidebarNavItem
            key={section.item.key}
            item={section.item}
            active={currentView === section.item.key}
            expanded={expanded}
            onClick={() => onNavigate(section.item.key)}
          />
        )
      })}
    </nav>
  )
}

// ────────────────────────────────────────────────────────────
// 桌面端侧边栏
// ────────────────────────────────────────────────────────────

function DesktopSidebar() {
  const { currentView, sidebarExpanded, toggleSidebar, setCurrentView } =
    useAppStore()

  const handleNavigate = useCallback(
    (key: NavItem['key']) => {
      setCurrentView(key)
    },
    [setCurrentView]
  )

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-slate-700 bg-slate-900 text-white transition-all duration-300 ease-in-out',
        sidebarExpanded ? 'w-60' : 'w-[60px]'
      )}
    >
      {/* Logo 区域 */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-slate-700 px-3',
          sidebarExpanded ? 'gap-2.5' : 'justify-center'
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20">
          <HardHat className="size-5 text-amber-400" />
        </div>
        {sidebarExpanded && (
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-bold leading-tight">
              凿岩机数据平台
            </span>
            <span className="truncate text-[10px] text-slate-500">
              全生命周期分析系统
            </span>
          </div>
        )}
      </div>

      {/* 导航列表 */}
      <div className="flex-1 overflow-y-auto py-3">
        <NavList
          currentView={currentView}
          expanded={sidebarExpanded}
          onNavigate={handleNavigate}
        />
      </div>

      {/* 折叠按钮 */}
      <div className="border-t border-slate-700 p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="w-full text-slate-400 hover:bg-white/10 hover:text-white"
        >
          {sidebarExpanded ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <span className="sr-only">
            {sidebarExpanded ? '收起侧边栏' : '展开侧边栏'}
          </span>
        </Button>
      </div>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────
// 移动端侧边栏（Sheet 抽屉）
// ────────────────────────────────────────────────────────────

function MobileSidebar() {
  const { currentView, mobileSheetOpen, setMobileSheetOpen, setCurrentView } =
    useAppStore()

  const handleNavigate = useCallback(
    (key: NavItem['key']) => {
      setCurrentView(key)
      setMobileSheetOpen(false)
    },
    [setCurrentView, setMobileSheetOpen]
  )

  return (
    <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
      <SheetContent side="left" className="w-72 bg-slate-900 text-white p-0">
        <SheetHeader className="border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20">
              <HardHat className="size-5 text-amber-400" />
            </div>
            <SheetTitle className="text-sm font-bold text-white">
              凿岩机数据平台
            </SheetTitle>
          </div>
          <SheetDescription className="text-slate-500 text-xs">
            全生命周期分析系统
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-3">
          <NavList
            currentView={currentView}
            expanded={true}
            onNavigate={handleNavigate}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ────────────────────────────────────────────────────────────
// 导出的统一组件
// ────────────────────────────────────────────────────────────

export function AppSidebar() {
  const isMobile = useIsMobile()
  const setMobileSheetOpen = useAppStore((s) => s.setMobileSheetOpen)

  return (
    <>
      {isMobile ? <MobileSidebar /> : <DesktopSidebar />}
      {/* 移动端汉堡按钮由 AppHeader 渲染，此处不渲染 */}
    </>
  )
}

/** 仅供 AppHeader 使用的移动端菜单按钮触发器 */
export function MobileMenuTrigger() {
  const isMobile = useIsMobile()
  const setMobileSheetOpen = useAppStore((s) => s.setMobileSheetOpen)

  if (!isMobile) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMobileSheetOpen(true)}
      className="md:hidden"
    >
      <Menu className="size-5" />
      <span className="sr-only">打开菜单</span>
    </Button>
  )
}