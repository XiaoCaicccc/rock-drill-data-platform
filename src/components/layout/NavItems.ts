import {
  LayoutDashboard,
  Server,
  Puzzle,
  SlidersHorizontal,
  PenLine,
  ScrollText,
  ScatterChart,
  FileBarChart,
  Briefcase,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import type { ViewType } from '@/store'

export interface NavItem {
  /** 视图标识，对应 store 中的 ViewType */
  key: ViewType
  /** 显示名称 */
  label: string
  /** 图标组件 */
  icon: LucideIcon
  /** 分组标题，用于视觉分组（null 表示不分组） */
  group: string | null
  /** 是否仅管理员可见 */
  adminOnly?: boolean
}

/**
 * MVP 全部导航项
 * group 不为 null 时，该项前会插入分组标题和分隔线
 */
export const NAV_ITEMS: NavItem[] = [
  // --- 数据总览 ---
  {
    key: 'dashboard',
    label: '数据总览',
    icon: LayoutDashboard,
    group: null,
  },
  // --- 档案管理 ---
  {
    key: 'equipment',
    label: '设备档案',
    icon: Server,
    group: '档案管理',
  },
  {
    key: 'parts',
    label: '零件档案',
    icon: Puzzle,
    group: null,
  },
  // --- 检测管理 ---
  {
    key: 'templates',
    label: '检测参数模板',
    icon: SlidersHorizontal,
    group: '检测管理',
  },
  {
    key: 'inspection-entry',
    label: '检测数据录入',
    icon: PenLine,
    group: null,
  },
  {
    key: 'inspection-ledger',
    label: '检测台账',
    icon: ScrollText,
    group: null,
  },
  // --- 分析与报告 ---
  {
    key: 'analysis',
    label: '配合参数分析',
    icon: ScatterChart,
    group: '分析与报告',
  },
  {
    key: 'reports',
    label: '分析报告',
    icon: FileBarChart,
    group: null,
  },
  // --- 部门工作台 ---
  {
    key: 'workspace',
    label: '部门工作台',
    icon: Briefcase,
    group: '部门助理',
  },
  // --- 系统管理（仅管理员） ---
  {
    key: 'user-management',
    label: '用户管理',
    icon: Shield,
    group: '系统管理',
    adminOnly: true,
  },
]

/** 获取某视图的显示名称 */
export function getViewLabel(key: ViewType): string {
  return NAV_ITEMS.find((item) => item.key === key)?.label ?? key
}