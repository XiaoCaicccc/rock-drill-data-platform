import { create } from 'zustand'

export type ViewType = 'dashboard' | 'inspections' | 'ledger' | 'reports' | 'tasks'

interface AppState {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))