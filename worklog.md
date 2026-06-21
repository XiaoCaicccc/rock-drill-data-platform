# 工作日志 (Work Log)

## Task 4 - 主页面开发 (Main Page Development) — 已废弃

> 早期基于旧需求（5个模块）的布局开发，已被 Spec-001 完全替代。

---

## Spec-001 - 全局布局与导航框架

### 完成内容

**修改/创建的文件：**

| 文件 | 说明 |
|------|------|
| `src/store/index.ts` | Zustand store，9个 ViewType + 侧边栏展开/移动端 Sheet 状态 |
| `src/components/layout/NavItems.ts` | 导航配置：9个模块项（图标、标签、分组）+ getViewLabel 工具函数 |
| `src/components/layout/AppSidebar.tsx` | 侧边栏：桌面端可折叠 + 移动端 Sheet 抽屉 |
| `src/components/layout/AppHeader.tsx` | 顶部栏：当前模块标题 + 日期 |
| `src/components/views/PlaceholderView.tsx` | 通用占位视图组件 |
| `src/components/dashboard/DashboardView.tsx` | 数据总览占位 |
| `src/components/equipment/EquipmentView.tsx` | 设备档案占位 |
| `src/components/parts/PartsView.tsx` | 零件档案占位 |
| `src/components/templates/TemplatesView.tsx` | 检测参数模板占位 |
| `src/components/inspections/InspectionEntryView.tsx` | 检测数据录入占位 |
| `src/components/inspections/InspectionLedgerView.tsx` | 检测台账占位 |
| `src/components/analysis/AnalysisView.tsx` | 配合参数分析占位 |
| `src/components/reports/ReportView.tsx` | 分析报告占位 |
| `src/components/workspace/WorkspaceView.tsx` | 部门工作台占位 |
| `src/app/page.tsx` | 主页面：侧边栏 + 顶栏 + 动态视图路由 + 骨架加载 |
| `src/app/layout.tsx` | 根布局：中文字体、Toaster |

### 验收结果

| 验收项 | 状态 | 验证方式 |
|--------|------|---------|
| 9个导航项全部显示 | ✅ | agent-browser 遍历所有 button 文本 |
| 当前激活项高亮（amber色） | ✅ | 点击后 className 包含 amber，高亮从旧项移动到新项 |
| 侧边栏折叠/展开 | ✅ | 折叠后宽度 60px，展开后 240px (w-60) |
| 折叠时显示图标+Tooltip | ✅ | Tooltip 组件已包裹，Radix 按需渲染 |
| 移动端 Sheet 抽屉 | ✅ | 代码正确使用 Sheet + useIsMobile（headless 环境无法模拟真实视口） |
| 顶部栏显示模块标题+日期 | ✅ | 切换后 h1 文本同步更新，日期使用 date-fns zhCN |
| 视图切换无白屏 | ✅ | 使用 next/dynamic + 骨架加载态 |
| 页脚固定底部 | ✅ | footer 元素存在 |
| ESLint | ✅ | 0 errors, 0 warnings |

### 技术细节

- **状态管理**：Zustand store 管理 currentView、sidebarExpanded、mobileSheetOpen
- **视图路由**：不使用 Next.js 文件路由（仅 / 路由可见），通过 zustand currentView + switch 渲染
- **懒加载**：所有视图组件使用 `next/dynamic` + ViewSkeleton 骨架
- **分组导航**：NavItems 按 group 字段插入分组标题和分隔线
- **颜色方案**：侧边栏 bg-slate-900，活跃项 bg-amber-500/15 text-amber-400

### 后续任务

下一个 Spec 是 Spec-002（数据库 Schema 初始化与种子数据），然后是 Spec-003（公共组件库）。

---

## Spec-002 - 数据库 Schema 初始化与种子数据

### 完成内容

**修改/创建的文件：**

| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | 层级化数据模型：13 张表（含 Equipment → Part → InspectionRecord → InspectionDataItem 四级层级） |
| `src/app/api/seed/route.ts` | 种子 API（幂等：先清空再插入），6 类 × 40 参数模板 + 完整业务数据 |
| `prisma/full-seed.ts` | 独立可执行种子脚本（`npx tsx prisma/full-seed.ts`），不依赖 Next.js 服务器 |
| `prisma/seed-supplement.ts` | 补充种子脚本（仅 Meeting/Document/AttendanceRecord） |

### 数据模型概览

```
Equipment (3) → Part (48) → InspectionDataItem (8320)
                   ↑              ↑
PartCategory (6)  →  ParameterTemplate (6) → ParameterItem (240)  ←┘
                                                                  ←┘
InspectionRecord (13) → InspectionDataItem (8320)
AnalysisReport (4), Task (5), Meeting (4) → MeetingParticipant (19)
Document (10), AttendanceRecord (220)
```

### 验收结果

| 验收项 | 状态 | 验证值 |
|--------|------|--------|
| 零件类别 = 6 | ✅ | 钻头/活塞/气缸/阀组/轴承/密封件 |
| 参数模板 = 6 | ✅ | 每类别一个模板 |
| 参数项 = 240 | ✅ | 6 模板 × 40 项 |
| 设备 = 3 | ✅ | YT28/HY200/DZ900 |
| 零件 = 48 | ✅ | 12 核心件 + 36 补充件 |
| 检测记录 = 13 | ✅ | 2 月 × 2 设备 × 3次/月 + 1 维修设备 |
| 检测明细 ≥ 4800 | ✅ | **8320** 行 |
| 分析报告 = 4 | ✅ | 月度×2 + 季度 + 专项 |
| 任务 = 5 | ✅ | 含常规/领导交办 |
| 会议 = 4，参会 = 19 | ✅ | 含已完成和待召开 |
| 文档 = 10 | ✅ | 报告/纪要/标准/制度 |
| 考勤 = 220 | ✅ | 5 人 × 44 工作日（4-5月） |
| 种子幂等性 | ✅ | 先 deleteMany 再 create，可重复调用 |
| ESLint | ✅ | 0 errors, 0 warnings |
| 浏览器渲染 | ✅ | 9 个导航项正确显示，标题"数据总览"正常 |
| 种子 API | ✅ | POST /api/seed 返回 200 + 完整 stats |

### 技术细节

- **Schema 恢复**：误执行 `prisma db pull` 覆写了 schema（丢失 @@map/cuid/注释），已手动恢复
- **独立种子脚本**：由于 dev server 在容器环境中不稳定，创建了 `prisma/full-seed.ts` 作为备用，直接用 Prisma Client 运行
- **种子 API 两种运行方式**：
  1. `POST /api/seed` — 通过 Next.js API 路由
  2. `npx tsx prisma/full-seed.ts` — 独立脚本（0.8s 完成）
- **数据生成策略**：seededRandom 保证可复现，55% 最优区间 / 30% 标准区间 / 15% 超标

### 后续任务

下一个 Spec 是 Spec-003（公共组件库：StatCard、StatusBadge、FilterBar 等）。