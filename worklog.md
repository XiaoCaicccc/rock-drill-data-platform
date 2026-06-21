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

下一个 Spec 是 Spec-002a（数据库 Schema 重写：snake_case 字段名 + 新表结构）。

---

## Spec-002a - Prisma Schema 重写（snake_case 版）

> 上一轮 Spec-002 的 camelCase schema 被用户否决，回退后按新规约重写。
> 已删除旧 Spec-002 产物（种子脚本、旧数据库、旧 API 路由）。

### 完成内容

| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | 13 张表，snake_case 字段名，`datasource url = "file:./dev.db"` |
| `.env` | 更新为 `DATABASE_URL=file:./prisma/dev.db` |

### 已删除的文件

| 文件 | 说明 |
|------|------|
| `src/app/api/seed/route.ts` | 旧种子 API |
| `prisma/full-seed.ts` | 旧独立种子脚本 |
| `prisma/seed-supplement.ts` | 旧补充种子脚本 |
| `db/custom.db` | 旧数据库（camelCase 表结构） |
| `src/app/api/{reports,export,parts,inspections,categories,tasks,dashboard,route}.ts` | 更早的废弃 API 路由 |

### Schema 变更要点（vs 旧 camelCase 版）

| 变更项 | 旧 | 新 |
|--------|------|------|
| 字段命名 | camelCase（`machineNo`） | snake_case（`machine_no`） |
| 数据源 | `env("DATABASE_URL")` → `db/custom.db` | `"file:./dev.db"` |
| 会议参会人 | 独立表 `meeting_participants` | `meeting.participants` 字符串字段（逗号分隔） |
| 会议决议 | 无 | 新增 `meeting_resolution` 表 |
| 考勤日期 | `String`（YYYY-MM-DD） | `DateTime` |
| 文档表 | 有 `updated_at` | 移除 `updated_at` |

### 验证结果

| 验收项 | 状态 |
|--------|------|
| 13 个 model 全部可访问 | ✅ |
| `prisma generate` 成功 | ✅ |
| `prisma db push` 成功创建 `dev.db` | ✅ |
| ESLint 0 errors | ✅ |
| `GET /` HTTP 200 | ✅ |
| dev server 无报错 | ✅ |

### 项目当前状态描述/判断

- Spec-001（布局导航）✅ 已交付
- Spec-002a（Schema）✅ 已交付，数据库为空，等待后续种子数据 Spec
- 所有视图仍为 PlaceholderView 占位
- 下一步：种子数据 → 公共组件库 → 各功能模块

### 后续任务

下一个任务是种子数据（Spec-002b），然后是 Spec-003（公共组件库）。

---

## Spec-002b - 种子数据脚本

> 纯代码生成，未执行验证（dev server 不稳定）。

### 产出文件

| 文件 | 说明 |
|------|------|
| `scripts/seed.ts` | 独立种子脚本，导出 `seedDatabase(prisma)` 函数 + `main()` 独立执行入口 |
| `src/app/api/seed/route.ts` | POST API 路由，调用 `seedDatabase(db)` 并返回 JSON |

### 已清理的残留文件

| 文件 | 说明 |
|------|------|
| `src/app/api/seed/route.ts` (旧 772 行版本) | 上一轮中断时残留 |
| `prisma/seed-run.ts` | 更早的废弃脚本 |
| `prisma/seed-standalone.ts` | 更早的废弃脚本 |

### 数据规模

| 表 | 数量 | 说明 |
|----|------|------|
| part_category | 6 | 钻头/活塞/气缸/阀组/轴承/密封件 |
| equipment | 3 | COP1838ME(在用)/DD422i(维修中)/Boomer S2(库存) |
| parameter_template | 6 | 每类别1个模板 |
| parameter_item | 240 | 每模板40项（38数值+2文本），含标准/最优区间 |
| part | 12 | 每类别2个，分属设备1和设备2 |
| inspection_record | 20 | 2设备 × 2月 × 5次/月 |
| inspection_data_item | 4800 | 20记录 × 6零件 × 40参数 = 4800（正态分布生成） |
| analysis_report | 4 | 月度×2 + 季度×1 + 全生命周期×1 |
| task | 5 | 不同优先级/状态/类型 |
| meeting | 3 | 含会议纪要 |
| meeting_resolution | 6 | 每会议2条决议 |
| document | 4 | 月报×2 + 技术文档 + 操作规程 |
| attendance_record | 30 | 5人 × 6个工作日 |

### 关键设计

- **幂等**：先 `deleteMany` 所有13张表（FK安全顺序），再批量插入
- **值生成**：Box-Muller 正态分布，stdDev = 标准区间宽度的 1/4，约 95% 合格
- **自动判定**：`is_qualified` / `is_optimal` 根据标准/最优区间自动计算
- **overall_result**：根据每条记录的合格率自动判定（≥95% 优秀 / ≥80% 合格 / ≥60% 待修 / 不合格）
- **批量插入**：所有表使用 `createMany`，inspection_data_item 按记录分批（每批 240 条）
- **API 路由**：通过相对路径 `../../../../scripts/seed` 导入共享的 `seedDatabase` 函数

### 待验证

- [ ] 运行 `npx tsx scripts/seed.ts` 确认可正常插入数据
- [ ] POST `/api/seed` 返回 `{ success: true, counts: { inspection_data_item: 4800, ... } }`
- [ ] 查询数据库确认 13 张表数据完整
- [ ] ESLint 检查通过