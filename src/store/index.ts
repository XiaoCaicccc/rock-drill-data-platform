import { create } from 'zustand'

/** MVP 全部9个模块视图 */
export type ViewType =
  | 'dashboard'
  | 'equipment'
  | 'parts'
  | 'templates'
  | 'inspection-entry'
  | 'inspection-ledger'
  | 'analysis'
  | 'reports'
  | 'workspace'

interface AppState {
  /** 当前激活的视图 */
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  /** 桌面端侧边栏是否展开 */
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  toggleSidebar: () => void

  /** 移动端侧边栏 Sheet 是否打开 */
  mobileSheetOpen: boolean
  setMobileSheetOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),

  sidebarExpanded: true,
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

  mobileSheetOpen: false,
  setMobileSheetOpen: (open) => set({ mobileSheetOpen: open }),
}))