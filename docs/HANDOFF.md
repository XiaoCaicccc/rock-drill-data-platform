# rock-drill-data-platform 正式交接文档

更新时间：2026-07-16
适用仓库：`rock-drill-data-platform`（`main`）

本文件面向后续开发 Agent。它只汇总已确认的项目事实、冻结规则和接管入口；具体实现与验收证据仍以对应 SPEC、决策、测试记录和源码为准。无法从当前仓库确认的信息必须标记为 `UNKNOWN`，不得把未来规划或推测写成当前实现。

## 1. 项目定位

`rock-drill-data-platform` 是面向凿岩机制造企业质量部门的质量数据管理与分析平台，长期方向是受控质量 PLM。

当前用户主要是质量管理员、检测人员、工程结论使用者、只读审阅者和系统管理员。当前阶段聚焦设备、零件版本、检测、分析、报告和质量追溯；不是完整 PLM，也未实现 BOM、工程变更、通用工作流等能力。

## 2. 当前版本状态

- 发布标签：`v0.1.0-spec001`
- 标签提交：`1540b47f10e56519f9a47e25b7a8d9b7de500b19`
- 当前 `main`：标签之后仍有文档提交；接管前必须以 `git status --short`、`git log -1 --oneline` 和 `git describe --tags --always HEAD` 为准。
- 数据库当前状态：生产环境使用 PostgreSQL；本地开发数据库状态必须以当前 `.env` / Prisma 配置和运行结果为准，不假设本地数据库已同步。
- `SPEC-001-A Data Scope Authorization`：Completed / PASS。
- `SPEC-001-B Report Lifecycle Workflow`：Completed / PASS。
- `SPEC-001 MVP`：Completed。核心质量业务闭环已完成。
- `SPEC-001-C System Hardening and Delivery Baseline`：Engineering hardening track / In Progress；它是工程强化与交付基线轨道，不影响 MVP 的 Completed 状态，但自身不得标记为整体 PASS。

已完成的阶段结论见 [SPEC-001-COMPLETION.md](./SPEC-001-COMPLETION.md)。当前工程尾项的权威状态见 [SPEC-001-C](./specs/SPEC-001-C-system-hardening-and-baseline.md)。

## 3. 技术架构

### Frontend

- Next.js App Router、React、TypeScript、Tailwind CSS。
- 当前业务入口是 [src/app/page.tsx](../src/app/page.tsx) 的 SPA 视图路由；通过 Zustand 的 `currentView` 切换主要业务视图，而非为每个业务对象新增页面路由。
- 登录页为 [src/app/login/page.tsx](../src/app/login/page.tsx)；业务组件按 `src/components/<domain>/` 组织。

### Backend

- Next.js Route Handler 位于 [src/app/api](../src/app/api)。
- Prisma 是数据库访问层；通用能力在 [src/lib](../src/lib)，包括认证、权限、审计、对象存储、报告状态机、参数分析和检测筛选规则。
- 复杂报告状态流转集中在 [src/lib/report-workflow.ts](../src/lib/report-workflow.ts)，不是由前端或 Route Handler 直接更新状态。

### Database

- PostgreSQL 是唯一生产业务数据库；Schema 位于 [prisma/schema.prisma](../prisma/schema.prisma)。
- 当前 Prisma schema 是数据库模型唯一来源；任何数据库结构判断必须以 `schema.prisma` 和 migration 历史为准，不根据旧文档推断。
- 结构变更只能新增 Prisma migration；生产环境使用 `prisma migrate deploy`，禁止用 `prisma db push` 改生产结构。

### Deployment

- Railway 承载生产应用与 PostgreSQL。
- Docker / CI 固定 Node 基线为 `>=20.19.0 <21`；Docker 使用锁文件与 `npm ci`，应用启动阶段不自动迁移。
- GitHub Actions 使用 Node 20 与临时 PostgreSQL，执行依赖安装、Prisma 校验/生成/迁移、类型检查、自动测试、lint 和构建；不连接 Railway 或生产数据库。

### 核心目录导航

```text
src/
  app/          # 页面、SPA 入口与 API Route Handler
  components/   # 按业务领域组织的前端组件
  lib/          # 认证、权限、审计、领域服务与纯规则
prisma/
  schema.prisma # 权威业务数据模型
  migrations/   # 不可回写的数据库迁移历史
scripts/        # 本地开发与构建辅助脚本
docs/           # 项目状态、SPEC、决策、测试与交接文档
```

## 4. 已完成功能

- 认证：NextAuth Credentials 登录；生产环境的初始化与种子入口受控。
- RBAC：`admin`、`quality_manager`、`inspector`、`engineer`、`viewer`。
- 数据范围：Dashboard、检测台账、参数分析、导出和报告查询在服务端、查询前执行授权与 Data Scope 解析。
- 设备管理：设备档案及零件版本装配/拆卸历史。
- 零件管理：零件主数据、受控零件版本、生命周期、图号、关键特性和当前版本关系。
- 参数模板：参数模板及参数项维护。
- 检测录入：检测记录与检测数据项；新数据可关联已发布零件版本，历史未知版本保持兼容。
- 检测台账：检索、筛选、分页与受控数据查询；搜索覆盖检测编号、零件名称/编码、检测员和批次。
- 参数分析：采用 `record_id + part_revision_id + parameter` 的复合匹配；未知版本不混入已知版本分析。
- 报告生命周期：`draft → reviewing → published`，支持 `reviewing → draft`；发布创建快照并写审计。
- 部门工作台：Dashboard 与现有任务、会议、考勤、文档等工作区视图；具体可用范围以页面与 API 为准。
- 导出：Dashboard 与检测数据导出；导出拥有独立的服务端权限与筛选契约。

### MVP 验收边界

SPEC-001 MVP 当前通过的是核心业务功能闭环验证：

- 页面可访问；
- 核心 CRUD 可运行；
- 权限控制已验证；
- 报告生命周期已验证；
- 分析、检测、导出主要流程可运行。

不代表企业级生产运维体系、完整 PLM 能力或所有工程债务已经完成。

## 5. 数据模型摘要

主要 Prisma model（字段和约束以 schema 为准）：

| 对象 | 作用与关键关系 |
| --- | --- |
| `user` | 身份、角色与审计责任主体。 |
| `equipment` | 真实现场设备实例。 |
| `part_category`、`part` | 稳定零件身份与分类。 |
| `part_revision` | 零件技术版本、生命周期、图号及关键特性；`part` 指向当前版本。 |
| `equipment_part_installation` | 设备与零件版本的安装/拆卸历史。 |
| `parameter_template`、`parameter_item` | 检测参数模板与参数定义。 |
| `inspection_record`、`inspection_data_item` | 一次检测活动及具体测量项；数据项可关联 `part_revision_id`。 |
| `analysis_report` | 分析报告、状态、来源上下文和零件版本链接。 |
| `analysis_report_snapshot` | 新发布报告的一对一发布快照及发布责任人。 |
| `analysis_report_part_revision` | 报告与零件版本的多对多链接。 |
| `AuditLog`（表 `audit_log`） | 关键操作的审计记录。 |
| `task`、`meeting`、`meeting_resolution`、`document`、`attendance_record` | 当前部门工作台相关业务对象。 |

## 6. 冻结规则

### 权限与查询

1. 受控查询必须在数据库查询前调用 `requireDataScopeResource()` 或等价的服务端授权入口。
2. Data Scope 必须进入 Prisma `where` / 等价数据库条件；禁止查全量后在内存或前端过滤。
3. 前端按钮显隐只改善体验，不能作为授权边界。
4. 匿名请求返回 401；已登录但无资源权限返回 403；有权限但无数据应返回 200 与空结果。
5. 不信任客户端传入的用户、组织、创建人、发布人或数据范围字段；以会话和服务端授权上下文为准。

| 资源 | 允许访问角色 | 关键限制 |
| --- | --- | --- |
| Dashboard | `admin`、`quality_manager`、`inspector`、`viewer` | `viewer` 仅统计；`engineer` 为 403。 |
| 检测台账、参数分析 | `admin`、`quality_manager`、`inspector` | 保持查询阶段 Data Scope。 |
| 导出 | `admin`、`quality_manager` | 导出权限高于查看权限；`inspector` 为 403。 |
| 报告查询 | `admin`、`quality_manager`、`inspector`、`engineer` | 后两者仅见 `published`；`viewer` 为 403。 |

### 报告生命周期与追溯

- 第一版状态机固定为 `draft → reviewing → published`，并允许 `reviewing → draft`。
- 仅 `admin`、`quality_manager` 可创建/编辑草稿和执行生命周期写操作。
- `published` 报告不可直接编辑、重新提交或物理删除；历史“已归档”数据保持可读但不进入第一版状态机。
- 发布必须在同一事务内完成：状态检查、来源范围校验、快照创建、状态更新和 `PUBLISH` 审计；任一步失败必须回滚。
- 正式质量数据、已发布版本和审计历史不得通过随意物理删除破坏追溯。

### 数据库与交付

- 不修改已有 migration；新增必填字段必须考虑历史数据回填。
- 生产数据库不使用 `db push`；不在容器启动时自动迁移。
- 不记录或提交密码、Token、MFA Secret、签名 URL、生产连接串、本地数据库、构建缓存或工具输出。

## 7. 已知问题

### Confirmed issue

- **ISSUE-004 — Windows Local Verification Environment（Blocked）**：当前 Windows 仅确认 Node `v22.17.0`，不满足冻结范围 `>=20.19.0 <21`；未确认可用 Node 20，Docker Desktop Linux Engine 也未运行。因此完整本地验证链未完成。这是环境前置条件，不是仓库代码失败。
- **ISSUE-002 — Dashboard Metric Logic Duplication（Open）**：Dashboard 与 Dashboard 导出仍各自维护统计/聚合实现，尽管已验证当前结果一致，后续仍有口径分叉风险。
- **ISSUE-005 — AI Coding Agent Collaboration Discipline（Open）**：新 SPEC 必须遵循事实核验、规则冻结、窄范围实现、人工 Review、验证和 Closure。
- **ISSUE-007 — Customer Inspection Template Compatibility（Open / Future SPEC-002）**：客户检测模板尚未形成受控质量模板管理能力；不阻塞当前 SPEC-001-C。

完整状态与归属以 [06_ISSUES.md](./06_ISSUES.md) 为准；已解决的报告弹窗和台账/导出筛选问题仍应纳入回归测试。

### Open technical debt / accepted limitations

- 报告 `source_context.inspection_record_ids` 保存内部 `inspection_record.id`，目前没有按 `record_no`、零件、日期选择来源检测记录的业务 UI。
- `analysis_identifiers` 尚无权威 `analysis_result` / `analysis_task` 实体；第一版只能做非空校验。
- C-2C-3B 的筛选回归实现已存在于 Git 历史，但当前 SPEC/测试文档仍写为 Pending CI Verification；可追溯的最终 CI 证据在现有文档中为 `UNKNOWN`，接管时应先核对 GitHub Actions 后再改状态。
- C-2C-3C 旧资产最终处置、C-2B 本地 Node 20 验证与 SPEC-001-C Closure 均未关闭。
- 组织级多租户隔离、备份恢复、完整监控告警、归档/报告版本/通知以及更大范围 PLM 不是当前实现范围。

## 8. Current Development Entry

当前没有进行中的源码开发任务。下一阶段不得默认开始开发；必须先创建新的 SPEC，并在实施前明确：

1. 需求范围与明确不做的内容；
2. 数据模型影响；
3. 权限矩阵与 Data Scope 影响；
4. Migration 策略与历史数据处理；
5. 可执行的验收标准与验证计划。

推荐候选是 **SPEC-002 Quality Template Management**，但仅作为候选，不代表已批准或已开始。

## 9. 后续开发建议

所有后续能力先建立独立 SPEC，明确数据影响、权限矩阵、迁移策略、验收计划和 Out of Scope。候选方向：

1. **SPEC-002 Quality Template Management**：将客户检测模板转化为受控参数模板、适用范围、版本与发布规则；不直接重写既有检测模型。
2. **Report Source Selection and Analysis Result Identity**：提供基于业务字段的来源检测记录选择器，并定义权威分析结果实体；解决当前内部 ID 与非空分析标识限制。
3. **Shared Query Contract / Reporting**：在不改变冻结 Data Scope 的前提下，逐步收敛 Dashboard、台账和导出的统计与筛选契约，关闭 ISSUE-002。
4. **SPEC-001-C 工程尾项**：先恢复 Windows Node 20 与 Docker 本地验证，再核实 C-2C-3B 证据、决定 C-2C-3C 旧资产处置，最后完成 C 的 Closure。

不应在未立项前提前建设 BOM、ECN/ECR、NCR/CAPA、通用审批引擎、多级审批或完整制造/服务协同。

## 10. Agent 接管流程

### Agent 工作模式

后续开发必须采用：

```text
需求确认 → SPEC 编写 → 决策冻结 → 小范围实现 → Review → 验证 → Closure
```

禁止：

- 直接根据用户描述修改大量代码；
- 未创建 SPEC 前扩展业务范围；
- 为了通过测试修改业务规则。

### 开始前必读

1. 本文件及 [CURRENT_STATE.md](./CURRENT_STATE.md)。
2. [SPEC-001-COMPLETION.md](./SPEC-001-COMPLETION.md)、[05_DECISIONS.md](./05_DECISIONS.md)、[06_ISSUES.md](./06_ISSUES.md)、[07_TESTING.md](./07_TESTING.md)、[08_DEVELOPMENT_WORKFLOW.md](./08_DEVELOPMENT_WORKFLOW.md)。
3. 与任务直接相关的 `docs/specs/` 文档；报告工作流读 `SPEC-001-B-report-workflow.md` 与 `SPEC-001-B-CLOSURE.md`，工程尾项读 SPEC-001-C。
4. 相关源码、[prisma/schema.prisma](../prisma/schema.prisma)、相关 Route Handler 与 `src/lib` 服务；不要无目的扫描全仓库。

### 执行边界

- 先运行 `git status --short`，保留任何用户已有变更；禁止 `git reset --hard`、破坏性 checkout 和强推。
- 先确认任务的 SPEC、冻结规则和修改范围；发现矛盾时停止并请求人工决策，不要自行改权限、状态机或历史规则。
- 不通过前端规避服务端授权；不连接/修改生产数据库来做纯测试；不使用生产凭据。
- Schema 变更必须有新 migration、历史数据方案和相称验证；不修改历史 migration。

### 验证与提交

```powershell
node -v
npm -v
npm ci
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run lint
npm run build
```

- 本地仅在 Node `>=20.19.0 <21` 且依赖环境可用时执行；PowerShell 阻止 `npm.ps1` 时可使用 `npm.cmd`，但它仍依赖有效的 `node.exe`。
- 本地条件缺失时，明确记录 Blocked / Not Run；不能把 CI 或 Railway 结果写成“本地通过”。
- 提交前至少执行 `git diff --check`，确认暂存范围、敏感文件和验证结果；仅在用户明确授权时提交或推送。
- 完成后更新对应 SPEC、测试记录、Issue 与 Closure；区分已验证事实、环境阻塞、技术债和 Future Item。

## 权威文档索引

- [HANDOFF.md](./HANDOFF.md)：Agent 接管入口；描述当前事实、冻结规则和开发边界。
- [README.md](../README.md)：运行、环境变量与开发/生产命令。
- [docs/specs/README.md](./specs/README.md)：SPEC 模板与使用入口。
- [docs/05_DECISIONS.md](./05_DECISIONS.md)：Data Scope、权限冻结与报告数据层决策。
- [docs/06_ISSUES.md](./06_ISSUES.md)：开放问题与后续归属。
- [docs/07_TESTING.md](./07_TESTING.md)：静态、CI 与运行时验证证据。

当前未发现其他 AI Agent 规则文件；如未来新增，应在本索引中登记。
