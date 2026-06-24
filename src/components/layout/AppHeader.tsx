'use client'

import { MobileMenuTrigger } from '@/components/layout/AppSidebar'
import { useAppStore } from '@/store'
import { getViewLabel } from '@/components/layout/NavItems'
import { useSession, signOut } from 'next-auth/react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar, LogOut, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

export function AppHeader() {
  const currentView = useAppStore((s) => s.currentView)
  const { data: session } = useSession()

  const userName = (session?.user as { name?: string })?.name || ''
  const userRole = (session?.user as { role?: string })?.role

  const today = format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })

  function handleLogout() {
    signOut({ callbackUrl: '/login' })
  }

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

          {/* 用户信息 + 退出 */}
          {session?.user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-1 gap-1.5">
                  <UserCircle className="size-4" />
                  <span className="hidden sm:inline max-w-[100px] truncate">{userName}</span>
                  {userRole === 'admin' && (
                    <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5 py-0">管理员</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{(session.user as { email?: string }).email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}