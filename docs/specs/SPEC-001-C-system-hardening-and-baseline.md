# SPEC-001-C: System Hardening and Delivery Baseline

状态：Draft
创建日期：2026-07-14

## 1. 背景

SPEC-001-A 已完成质量数据授权与 Data Scope 验收，SPEC-001-B 已完成报告生命周期闭环。当前遗留项集中在既有能力的可靠性交付：查询与导出一致性、可重复的本地/CI 验证，以及可追溯的生产交付与文档闭环。

本 SPEC 不增加新的质量业务流程，仅收敛 `06_ISSUES.md`、`04_ROADMAP.md` 与已关闭 SPEC 中已记录的工程和交付缺口。

## C-0 Baseline Audit

**状态**：Complete。

### 启动前基线

SPEC-001-C 在以下已验证基线上启动，不重新验收或改变已关闭 SPEC 的业务规则：

- SPEC-001-A：PASS；
- SPEC-001-B：PASS；
- 当前基线 tag：`SPEC-001-B-PASS`；
- 当前主分支已包含 SPEC-001-B Closure。

### 当前系统状态

- Railway 已部署并运行；
- 生产业务数据库为 PostgreSQL；
- Prisma Migration 已存在并已应用；
- 当前主要业务能力已覆盖：设备档案、零件档案、检测参数模板、检测数据录入、检测台账、配合参数分析、分析报告生命周期，以及六类身份的 Data Scope 与授权控制。

本基线只记录启动事实，不重新验收 A/B，不修改已冻结的权限、状态机和数据模型。它用于界定 C 的回归范围：任何发现的 A/B 行为差异应先记录为回归问题，不得通过修改既有冻结决策来规避。

## 2. 业务目标

让质量部门已上线的查询、导出和报告能力具备可重复验证的工程基线，降低统计口径分叉、环境不可验证和无证据交付的风险。

## 3. 范围

### 包含

1. **C-1A 遗留问题收敛**
   - 为 Dashboard 与 Dashboard 导出建立一致的统计/筛选查询契约，消除 `ISSUE-002` 的口径分叉风险。
   - 为检测台账与检测导出补充一致性回归验证，防止 `ISSUE-003` 复发。
   - 将已解决、仍开放和需后续 SPEC 处理的问题更新为可追踪状态。

2. **工程质量基线**
   - 修复或明确隔离本地 Node/npx 类型检查与 Docker Compose 验证环境问题（`ISSUE-004`）。
   - 固化与既有架构匹配的最小验证链：依赖安装、Prisma 生成、类型检查、lint、构建、迁移检查和针对性回归测试。
   - 确认 CI 对上述关键验证的覆盖与失败可见性；不足之处只在本 SPEC 范围内补齐。

3. **生产交付基线**
   - 固化发布前、数据库迁移、Railway 部署后和运行时验收的最小检查清单。
   - 确认生产交付不绕过 Prisma migration、服务端授权或审计边界。
   - 为既有 SPEC-001-A / SPEC-001-B 的关键路径保留可复核的部署与验证证据。

4. **文档体系完善**
   - 将验证命令、环境前置条件、交付检查和 Closure 证据归入现有 `docs/` 体系。
   - 执行既有开发流程：SPEC → Implementation → AI Coding → Review → Verification → Deploy → Runtime Test → Closure。

### Out of Scope

- 来源检测记录选择器、`analysis_result` / `analysis_task` 实体化；
- 新的质量业务流程、报告归档/版本/通知、通用工作流或审批引擎；
- BOM、产品型号、工程变更、NCR/CAPA、供应商质量等 PLM 扩展；
- 修改 SPEC-001-A 的 Data Scope 矩阵或 SPEC-001-B 的报告生命周期权限/状态规则；
- 未由工程基线缺陷直接要求的 Prisma Schema、migration 或角色模型变更。

## C-1 既有功能一致性与阻断性可用问题收敛

**状态**：Completed / PASS。

### C-1A 查询与导出一致性收敛

**状态**：Completed / PASS。

本任务依据 C-1A Query Audit 拆分为以下最小实施项：

#### C-1A-1 Dashboard Export Alignment

**状态**：Implementation Complete → Runtime Verification PASS。

范围：

- Dashboard 与 Dashboard Export 的待办事项统计一致；
- 时间窗口定义一致；
- 趋势和类别结果排序稳定。

**运行时验证证据**：

- `admin` 登录验证通过；
- `quality_manager` 登录验证通过；
- Dashboard 与 Dashboard Export 待办事项统计一致；
- 月度趋势数据与趋势月份标签一致，趋势排序稳定；
- 类别统计排序一致。

本项未修改 Schema、Migration、权限模型或 Data Scope，且 API response shape 保持不变。

#### C-1A-2 Inspection Search Contract Alignment

**状态**：Runtime Verification PASS。

范围：

- 台账搜索提示与实际能力一致；
- 零件名称、零件编码搜索能力统一；
- 导出与台账筛选契约一致。

**运行时验证证据**：

- `admin`：零件编码、零件名称、检测编号、检测员与批次搜索均通过；零件名称/编码筛选后的页面与导出结果一致，组合筛选、空结果处理与原有搜索能力均通过；
- `quality_manager`：零件名称、零件编码搜索以及检测台账与导出均通过，权限和数据范围保持不变；
- 检测台账与检测导出继续使用同一搜索契约。

本项未修改 Prisma Schema、Migration、权限模型、Data Scope、分页或 API 返回结构。

共同约束：

- 不新增公共查询层；
- 不修改 Schema；
- 不修改权限模型；
- 不修改 Data Scope；
- 需要代码与针对性回归测试。

### C-1B 分析报告弹窗滚动与响应式可用性修复

**问题背景**：Railway production 实际操作发现分析报告的新建/编辑弹窗内容可能超过浏览器视口。桌面端在浏览器 100% 缩放下无法访问完整表单和底部操作按钮，只能缩小页面比例继续操作；移动端弹窗不能正常滚动，用户无法完成新建或编辑。

**问题等级**：P1 Existing Usability Defect。该问题阻断既有报告核心流程，属于 SPEC-001-C 必须解决的现有功能缺陷，而非未来功能优化。

**实施状态**：Implementation → Runtime Verification PASS。

**验证证据**：

- Desktop browser 100% zoom：PASS；
- Low height viewport：PASS；
- Mobile viewport：PASS；
- New report：PASS；
- Edit draft：PASS。

**预计实现位置**：优先检查 `src/components/reports/ReportView.tsx`。仅确认多个 Dialog 都存在同类问题时，才考虑 `src/components/ui/dialog.tsx`；禁止为本问题进行全局 Dialog 重构。

**实现约束**：

- 不修改报告字段、报告 API、`source_context` 规则、报告权限或状态机；
- 不新增来源检测记录选择器或 Analysis Result 实体；
- 不修改 Prisma Schema 或 Migration。

**验收标准**：

1. 桌面端浏览器 100% 缩放下可访问全部字段和操作按钮；
2. 内容超过视口时，弹窗内部存在独立纵向滚动；
3. 页面主体不需要通过缩放才能操作；
4. 新建报告和编辑报告均已修复；
5. 移动端无需缩放即可完成新建与编辑，且不存在横向溢出；
6. 移动端软键盘弹出后，仍可滚动到当前输入框和底部按钮；
7. 取消、保存、提交审核等操作始终可访问；
8. 不影响 `source_context` 校验、六类身份权限和报告生命周期。

## C-2 工程质量与验证基线

**状态**：Audit Complete → Implementation。

### C-2A Deterministic Build and Migration Gate

**状态**：Implementation / Pending CI Verification。

- Docker 依赖层使用 `package.json` 与 `package-lock.json` 执行 `npm ci`，使容器安装结果与锁文件一致；
- CI 保留依赖安装、Prisma Client 生成、类型检查、lint 与构建，并增加 Prisma Schema Validate；
- CI 使用仅限临时 service container 的 PostgreSQL 执行 `prisma migrate deploy`，验证全部历史 migration 可从空数据库完整应用；
- 不连接 Railway 或生产数据库，不使用 `prisma db push`，也不在应用启动时自动迁移；
- 不修改 Schema、Migration、业务代码、Data Scope 或已冻结权限规则。

本项的 CI 验证通过后，才可标记为 Runtime Verification PASS。

### Deferred C-2B / C-2C

- **C-2B**：Windows 本地 Node/PATH、`cp` / `tee` 跨平台兼容，以及本地 Node 20 安装与验证指引；
- **C-2C**：自动化测试门禁、`scripts/test-param-analysis.ts` 的旧 SQLite 依赖、`prisma/dev.db`、`bun.lock` 与少量高价值回归测试。

本轮不处理以上事项。

## 4. 领域规则与状态机

- 本 SPEC 不新增或改变业务状态机。
- 查询与导出必须继续在数据库查询阶段应用既有 Data Scope；不得读取全量后在内存或前端过滤。
- Dashboard、台账与导出的一致性修复不得扩大任一角色可见数据范围。
- 发布报告、正式质量记录和既有审计历史不得因基线改造被覆盖、删除或重写。

## 5. Permission Decision Freeze

本 SPEC 不修改已冻结的角色、资源、动作与范围决策。

| Role | Resource | Action | Decision | Reason |
| --- | --- | --- | --- | --- |
| 所有既有角色 | 已受控查询与导出 | 保持 SPEC-001-A 规则 | Unchanged | 工程基线不能改变业务授权。 |
| `admin` / `quality_manager` | 生产交付验证 | 按既有职责执行 | Scoped | 不新增运行时管理权限。 |

## 6. API 与数据影响

- API：仅在统一查询契约、输入/筛选一致性或验证需要时调整既有 Dashboard、检测台账和导出接口；不新增业务路由。
- 数据模型 / migration：预计无结构变化；如发现必要结构缺陷，停止并另行提出数据影响分析与迁移方案。
- 查询条件与 Data Scope：复用 `requireDataScopeResource()` 及现有 Prisma where 范围，查询前授权不变。
- 审计影响：不削弱既有审计；若新增受控写操作，必须按现有审计规则记录。

## 7. Acceptance Criteria

### AC-001：查询与导出一致性

- Given：同一角色、同一时间范围和同一筛选条件。
- When：分别查询 Dashboard/台账和对应导出。
- Then：结果范围与统计口径一致；不发生跨 Data Scope 数据泄露。

### AC-002：授权回归

- Given：SPEC-001-A 的六类身份。
- When：访问受控查询、导出和报告接口。
- Then：原有 401、403、200 + 空结果及已发布报告可见性规则保持不变。

### AC-003：本地与 CI 验证基线

- Given：项目锁定依赖和开发环境前置条件已满足。
- When：执行规定的类型检查、lint、构建、Prisma 与针对性测试。
- Then：命令可被重复执行；失败能给出可定位的原因；CI 对关键门禁可见。

### AC-004：生产交付基线

- Given：包含迁移或受控查询变更的发布候选。
- When：执行发布前检查、Prisma migration、Railway 部署和运行时抽样验证。
- Then：部署、迁移和关键权限/数据一致性验证均有记录；任一失败不得标记发布完成。

### AC-005：文档 Closure

- Given：本 SPEC 实现与验证完成。
- When：执行 Closure。
- Then：当前状态、问题状态、测试证据、决策与 Closure 文档在同一权威 docs 仓库中同步更新。

## 8. Verification Plan

| 项目 | 内容 |
| --- | --- |
| Test environment | 本地可重复环境、CI 与 Railway production；分别记录结果。 |
| Test account | 复用既有角色账号，仅记录 role、purpose、scenario，不记录密码。 |
| Static Verification | `git diff --check`、Prisma 生成、TypeScript、lint、构建及相关测试。 |
| Runtime Verification | 同筛选的页面/API/导出一致性、六类身份授权回归、Railway 部署与 migration。 |
| Evidence | CI 日志、部署日志、命令输出、受控截图和 Closure 记录。 |

Static Verification 与 Runtime Verification 必须分别记录；本地环境不可用不得伪造通过，需在 Issue 中说明并使用已批准的替代验证。

## 9. 已知限制

- `source_context` 的手工内部检测记录 ID 输入与 `analysis_identifiers` 的非空校验，仍是已接受的第一版限制，不属于本 SPEC 的实现范围。
- 本 SPEC 不能替代组织级多租户隔离、备份恢复体系或完整可观测性平台的独立设计。

## 10. Future Improvements

- 来源检测记录业务选择器；
- 权威分析结果实体与可验证来源关系；
- 共享查询服务的进一步抽象，以及更完整的自动化回归测试；
- 生产备份、恢复演练和监控告警的独立运维 SPEC。

## Future Item Transfer Rule

未纳入 SPEC-001-C 的 Future Item 必须在现有路线、Issue 或后续 SPEC 中记录以下信息：

- 背景原因；
- 当前不实现原因；
- 是否阻塞 SPEC-001；
- 后续归属 SPEC（如已知）；
- 当前状态。
- 重新进入实施阶段的触发条件。

以下事项不阻塞 SPEC-001-C：

- 来源检测记录选择器；
- Analysis Result / Analysis Task 实体化；
- 备份与恢复体系；
- BOM、ECN、NCR/CAPA 等更大范围 PLM 能力；
- 报告通知、通用工作流、复杂版本管理。

它们只能通过独立 SPEC 进入实施，不得在 C 的一致性、工程基线或交付基线任务中隐式实现。

## 11. Closure Checklist

- [ ] 范围、Out of Scope 和权限不变原则已冻结。
- [ ] 遗留问题与回归范围已逐项确认。
- [ ] 工程验证链与 CI 覆盖已验证。
- [ ] 生产部署与运行时证据已记录。
- [ ] 文档、Issue、测试记录和 Closure 已同步。
