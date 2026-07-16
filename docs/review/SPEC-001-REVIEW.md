# SPEC-001 Review Audit

审计日期：2026-07-16

审计对象：`rock-drill-data-platform`，HEAD `270a9a5` (`docs: finalize handoff specification`)

审计方式：源码、Prisma schema/migration、指定项目文档与现有测试/CI 配置的只读静态审计；未修改源码、既有文档或 migration。

## Summary

结论：**BLOCKED**

当前源码不能支持 `HANDOFF.md` 与 `CURRENT_STATE.md` 中“SPEC-001 MVP Completed / 核心质量业务闭环已完成”的 Closure 结论。审计确认 6 项 Blocking Issue：会话角色/停用状态不能及时撤销、检测明细存在冻结 RBAC 绕过、检测写入链缺少服务端关系完整性校验且 inspector 主流程不闭环、报告草稿编辑存在绕过发布不可变性的并发窗口、Dashboard 月度“检测数”实际统计检测数据项、零方差参数分析被错误报告为相关系数 0。

SPEC-001-A/B 的主要设计骨架存在，发布事务、报告状态机、列表/导出筛选共享规则、参数版本隔离和 CI migration gate 等区域可确认；但上述问题直接影响权限、正式质量记录不可变性或质量数据正确性，不能降级为普通工程债。

Findings：**21**（Blocking 6，Non-blocking 15）。

## Blocking Issues

### AUTH-001

Severity: Critical

Location: `src/lib/auth.ts:33,70-84`; `src/lib/permissions.ts:67-78`

Problem: 用户的角色、组织和 active 状态只在 Credentials 登录时从数据库读取，之后由 JWT 中的旧值持续授权。管理员在数据库中停用用户或降低角色后，已有会话仍可继续以旧角色调用受保护 API，直到会话自行失效或重新登录。

Evidence: `authorize()` 检查 `user.active` 并返回数据库角色；`jwt()` 仅在存在 `user`（登录时）写入 `token.role` / `token.organizationId`；后续 `session()` 直接复制 token；`requireAuth()` 不重新读取用户状态。

Recommendation: 在独立安全修复 SPEC 中冻结会话撤销策略；至少使角色/active 变更能使现有会话失效或在服务端授权时重新确认权威用户状态，并补充“降权、停用后旧会话立即失权”的回归测试。

### AUTH-002

Severity: High

Location: `src/app/api/inspections/[id]/details/route.ts:11-52`; `src/lib/permissions.ts:103-114`

Problem: 单条检测明细仅要求登录并执行 owner/admin 判断，没有调用冻结的 `inspection_ledger` 资源授权。`engineer` 按 SPEC-001-A 应对检测资源返回 403，但若其是记录 owner，可直接读取完整检测明细；这与文档记录的 engineer 检测资源 403 不一致。

Evidence: 列表 `/api/inspections` 在查询前调用 `requireDataScopeResource('inspection_ledger')`，明细路由改用 `requireAuth()` + `requireOwnershipOrAdmin(record.user_id)`；后者允许资源 owner，而不检查 `RESOURCE_ALLOWED_ROLES.inspection_ledger`。

Recommendation: 先按 SPEC-001-A 冻结矩阵修复所有检测读取入口的一致授权，并增加 list/detail 两类端点的六身份 API 回归测试。

### FLOW-001

Severity: Critical

Location: `src/app/api/inspections/batch/route.ts:16-58`; `src/app/api/equipment/route.ts:31-40`; `src/app/api/equipment/[id]/parts/route.ts`; `src/lib/permissions.ts:131-140`

Problem: “设备 → 装配零件版本 → 参数模板 → 检测记录 → 检测数据”没有形成可信的服务端闭环。批量写入只分别确认设备存在、零件版本已发布、参数项存在，没有确认零件版本实际装配在该设备上，也没有确认参数项所属模板类别与零件类别一致；直接调用 API 可以把任意已发布零件版本和任意参数项写到任意设备记录。与此同时，inspector 获取设备/装配数据走 legacy owner scope；种子设备 `created_by` 为 null，因此 inspector 的录入 UI 无法取得设备与装配零件，角色主流程不闭环。

Evidence: batch 路由对三个对象做独立查询后直接 `createMany`；未查询 `equipment_part_installation` 或 `parameter_template.category_id`。设备列表通过 `applyDataScope()` 将非 admin/quality_manager 收窄为 `created_by = session.user.id`，装配读取也执行 owner/admin 检查；seed 创建设备时未写 `created_by`。

Recommendation: 在进入 SPEC-002 前创建窄范围的检测完整性修复 SPEC，明确 inspector 的设备/装配读取范围，并在同一事务中验证设备装配、零件版本、类别模板、参数项及重复测量约束；补充直接 API 绕过测试。

### REPORT-001

Severity: Critical

Location: `src/app/api/reports/route.ts:150-193`; `src/lib/report-workflow.ts:168-176,247-253`

Problem: 草稿编辑先读取状态，再用仅含 `id` 的 `analysis_report.update()` 写入，未把“仍是草稿”放入写条件或事务。编辑请求与提交/发布并发时，可在状态已变为 reviewing/published 后继续覆盖报告正文和来源链接，破坏“published 不可直接编辑”和快照/当前展示一致性。

Evidence: 工作流转换使用 `updateMany({ where: { id, status: oldStatus } })` 做乐观并发保护；普通 PUT 在检查 `existing.status === 草稿` 后执行 `update({ where: { id }, data })`，缺少相同保护。GET 报告返回当前 `analysis_report`，未改为读取发布快照。

Recommendation: 通过报告工作流修复 SPEC 将草稿编辑收口到带状态前置条件的事务/服务层，并加入“编辑与提交/发布竞争”的数据库级回归测试；发布后读取应明确当前行与 snapshot 的权威关系。

### DATA-001

Severity: High

Location: `src/app/api/dashboard/route.ts:87-98,177-181`; `src/app/api/export/route.ts:151-162,229-232`; `src/components/dashboard/DashboardView.tsx:176-203`

Problem: 月度趋势 UI/CSV 标为“检测数”，SQL 却在 `inspection_record JOIN inspection_data_item` 后使用 `COUNT(*)`，统计的是检测数据项数量而不是检测记录数量。一条含 40 个数据项的检测会被计为 40 次检测。Dashboard 与导出当前只是“一致地错误”，C-1A 的一致性验收没有验证业务口径。

Evidence: 总量和本月量使用 `inspection_record.count()`；月度趋势使用 join 后 `COUNT(*)`；前端 Bar 与 CSV header 均明确显示“检测数”。

Recommendation: 在 Shared Query Contract 或独立质量指标修复 SPEC 中先冻结“检测数/测量项数”定义，修正查询并以多数据项单记录样例建立回归测试；完成前不应把 Dashboard 指标作为已验证质量数据。

### ANALYSIS-001

Severity: High

Location: `src/app/api/analysis/param-comparison/route.ts:143-154`

Problem: 当任一参数序列零方差时 Pearson 相关系数未定义，当前实现返回 0，等价呈现为“无线性相关”，会给工程结论造成错误语义。

Evidence: `denominator === 0 ? 0 : numerator / denominator`；仅空数据和少于两个配对返回 null，零方差没有异常/不可计算状态。

Recommendation: 在分析契约修复 SPEC 中明确不可计算响应语义并补充常量序列、单点、空集和重复测量测试；不要用数值 0 代替未定义结果。

## Non-blocking Issues

### DOC-001 — Document Consistency Finding

Severity: Medium

Location: `docs/HANDOFF.md:22-25,159-160`; `docs/CURRENT_STATE.md:38-49`

Problem: 文档把 SPEC-001 MVP 标为 Completed，但当前源码仍有 AUTH-001/002、FLOW-001、REPORT-001、DATA-001、ANALYSIS-001。该完成声明与本次源码审计不一致。

Recommendation: 修复并验证 Blocking Issues 后再重新执行 Closure；在此之前，权威状态应为 Blocked/Reopened，而非 Completed。

### DOC-002 — Document Consistency Finding

Severity: Low

Location: `docs/specs/SPEC-001-C-system-hardening-and-baseline.md:3,193-196,301-307,315-366`; `docs/07_TESTING.md:151-210`; `docs/specs/README.md`

Problem: SPEC-001-C 顶部仍为 Draft，正文早期仍声称没有 test 脚本且 legacy 文件被跟踪，后续追加段又记录测试已实现；当前 Git 已不跟踪 `bun.lock`、`prisma/dev.db`、`scripts/test-param-analysis.ts`。C-2C-3B 仍缺文档可核验的最终 CI 证据，Closure checklist 全部未完成；SPEC 索引也未列出 C。

Recommendation: 不在本审计中改文档；C 尾项完成后一次性校正文档结构、资产事实、CI 证据、索引和 Closure 状态。

### AUTH-003 — Authorization Finding

Severity: Medium

Location: `src/app/api/auth/mfa/setup/route.ts`; `src/app/api/auth/mfa/verify/route.ts`; `src/lib/auth.ts:20-68`

Problem: API 可把 `mfa_enabled` 设为 true，但 Credentials 登录完全不读取或验证 MFA。该功能当前只是配置数据，不是实际第二因素。

Recommendation: 在独立认证 SPEC 完成挑战流程前，不应把 MFA 视为已启用安全能力；需覆盖恢复、撤销、重放和敏感 secret 处理。

### DB-001 — Database Finding

Severity: High

Location: `prisma/schema.prisma:188-206,236-256`

Problem: `parameter_item` 没有 `(template_id, param_code)` 唯一约束，`inspection_data_item` 也没有 `(record_id, part_revision_id, param_item_id)` 唯一约束。重复定义/重复测量会让参数配对 Map 覆盖或一对多重复，结果依赖写入顺序。

Recommendation: 先做生产重复数据审计与回填方案，再通过新 migration 增加符合业务冻结规则的约束；不得修改历史 migration。

### DB-002 — Database Finding

Severity: Medium

Location: `prisma/schema.prisma:41,75,94,116,149-150,175,343,381,399,412`

Problem: 多个 `created_by` / `released_by` 是 nullable 或无 FK 的裸字符串；`organization_id` 也没有组织实体/关系。这些字段不能提供强引用完整性，历史责任人可成为孤儿值，组织隔离无法由模型保证。

Recommendation: 作为后续独立数据治理 SPEC 的输入；先确认历史值和删除策略，不在当前审计中做 schema 变更。

### DB-003 — Database Finding

Severity: Medium

Location: `prisma/schema.prisma:155,247,416,430`

Problem: `part -> part_revision`、`equipment -> equipment_part_installation`、`inspection_record -> inspection_data_item`、`analysis_report -> link` 使用 Cascade。部分 API 有前置保护，但数据库层仍允许上游删除同时抹去版本/装配/检测明细等历史关系，和正式质量数据追溯优先级存在张力。

Recommendation: 在删除策略 SPEC 中逐关系确认哪些是草稿聚合、哪些是正式历史；只对实际历史风险设计 Restrict/软删除和迁移回填。

### DB-004 — Database Finding

Severity: Low

Location: `prisma/schema.prisma:212-230,188-206`

Problem: 高频查询字段 `inspection_record.inspection_date/equipment_id/user_id` 和 `parameter_item.template_id` 缺少相应索引；数据增长后 Dashboard、台账、模板装载和关联查询存在明显退化风险。

Recommendation: 用生产规模与查询计划确认后，通过新的性能 migration 增加最小索引。

### FLOW-002 — Business Flow Finding

Severity: Medium

Location: `src/app/api/reports/route.ts:23-45`; `src/app/api/reports/[id]/submit-review/route.ts:34-61`; `src/app/api/reports/[id]/publish/route.ts:30-57`

Problem: 报告来源校验只确认检测记录和零件版本分别存在，未确认检测记录确实包含这些零件版本；`analysis_identifiers` 只校验非空。可发布语义上互不相关的来源组合。

Recommendation: 保留为 HANDOFF 已承认的限制，但应在进入更强报告/模板阶段前建立来源选择器与权威 Analysis Result SPEC。

### API-001 — API Reliability Finding

Severity: Medium

Location: 多个 `src/app/api/**/route.ts`，例如 `reports/route.ts:91-100,135-143`、`users/route.ts:34-42,71-79`

Problem: 多数写接口直接 `request.json()` 且缺少统一 schema/parse 错误处理；Malformed JSON、错误类型或 Prisma 异常会出现不一致的 400/500，部分路由返回框架默认错误而非稳定 JSON 契约。

Recommendation: 通过 API reliability SPEC 统一 JSON 解析、Zod 输入契约和 Prisma P20xx 映射，优先覆盖质量核心写接口。

### API-002 — API Reliability Finding

Severity: Low

Location: `src/app/api/export/route.ts:40-58,65-76`; `src/app/api/inspections/route.ts:18-28`

Problem: 相同的无效日期/倒序日期，台账返回 400，导出把 filter error 抛到外层并返回 500，违反共享筛选契约的错误语义一致性。

Recommendation: 在 C-2C-3B 后续契约测试中加入状态码与错误体，而不只测试纯 where builder。

### API-003 — API Reliability Finding

Severity: Medium

Location: `src/app/api/inspections/batch/route.ts:50-66`

Problem: 检测编号以“同日前缀 count + 1”生成，虽使用 Serializable transaction，但未对序列化冲突/唯一冲突进行有限重试；并发录入会把可恢复冲突返回为泛化 400。

Recommendation: 在检测可靠性修复 SPEC 中定义编号生成与重试策略，并做并发写入测试。

### FRONT-001 — Frontend Finding

Severity: Medium

Location: `src/components/layout/NavItems.ts:33-100`; `src/components/layout/AppSidebar.tsx:92-96`; `src/app/page.tsx:66-105`

Problem: 除用户管理外，所有导航项对所有登录角色可见；engineer/viewer 会被引导进入 Dashboard、台账、分析、报告等服务端明确 403 的页面。ViewRouter 本身也没有角色路由约束，造成大量可预期错误态和对权限能力的误导。

Recommendation: 保持 API 为最终边界，同时让导航可见性与冻结资源矩阵一致；不得通过前端显隐扩大权限。

### FRONT-002 — Frontend Finding

Severity: Low

Location: `src/app`（无 `error.tsx` / `loading.tsx`）；`src/components/reports/ReportView.tsx:163-167`; 多个业务视图 fetch effect

Problem: 组件级主要列表普遍有 loading/error 状态，但没有 App Router error boundary；部分辅助 fetch 忽略非 2xx 或静默吞错，动态 chunk/渲染异常可能导致整页失效或缺数据但无解释。

Recommendation: 后续前端可靠性任务补充最小全局错误边界，并让关键依赖数据加载失败可见；不需要 UI 重设计。

### DEPLOY-001 — Deployment Finding

Severity: Medium

Location: `Dockerfile:45-56`; `package.json:18`; `.github/workflows/ci.yml:34-48`

Problem: CI 能在临时 PostgreSQL 执行 `prisma migrate deploy`，镜像也携带 CLI/schema/migrations，但生产容器 CMD 只启动 server；仓库没有 Railway deploy/predeploy 配置。生产迁移依赖人工 Console 流程，部署新代码到旧 schema 的顺序无法由仓库门禁保证。

Recommendation: 在 SPEC-001-C 生产交付尾项中记录并固化受控 Railway migration/release 顺序、失败回滚和部署后抽样证据；不建议在应用启动时自动迁移。

### DEPLOY-002 — Deployment Finding

Severity: Low

Location: `Dockerfile:1`

Problem: `node:20-alpine` 未固定 patch/digest，依赖安装虽由 lockfile 固定，但基础运行时仍可随镜像标签变化，不是完全可重复构建。

Recommendation: 在交付基线维护任务中固定受支持的 Node 20 patch 或 digest，并制定更新节奏。

## Verified Areas

- `GET /api/dashboard`、`GET /api/inspections`、参数分析、导出和报告列表在目标 Route 内均先调用 `requireDataScopeResource()`；报告列表对 inspector/engineer 的 `status = 已发布` 条件进入 Prisma `where`。
- viewer Dashboard 不查询设备健康、最近检测和待办明细；export 具有独立 admin/quality_manager 资源授权。
- 报告状态机只允许 `draft -> reviewing -> published` 与 `reviewing -> draft`；未知/历史归档状态被拒绝进入状态机。
- 正常发布路径在一个 Prisma transaction 内创建 snapshot、条件更新状态并写 `PUBLISH` audit log；snapshot 对 report 一对一且发布人与报告关系为 Restrict。
- 新建报告、报告生命周期接口、用户管理、种子和开发 setup 路由均使用服务端会话/角色；客户端提交的 `user_id`、`created_by`、`released_by` 不直接作为权威身份写入这些核心路径。
- 参数分析按 `record_id + part_revision_id + selected parameter pair` 配对；未知版本被排除；空集和单点返回 null/空分布。
- 检测台账与检测导出复用 `inspection-filters.ts`；搜索覆盖编号、检测员、批次、零件名/编码、结果、类别和日期。
- Prisma 使用 PostgreSQL；schema 变化均体现在新增 migration 中，未发现修改既有 migration 的证据。现有 CI 配置会对空临时 PostgreSQL 执行完整 `prisma migrate deploy`。
- 前端存在 SPA 入口、登录页以及设备、零件、模板、检测录入、台账、分析、报告和工作台视图；主要核心列表具备组件级 loading/error/empty 状态。
- Docker 使用 `package-lock.json` + `npm ci` 构建 standalone，生产 CMD 不执行 `db push` 或自动 migration；`.env.example` 覆盖数据库、认证和对象存储必要变量。
- 文档上传使用对象存储预签名 URL，运行时文件未写入 `public/`；审计 helper 只保存显式摘要、IP 和 user-agent，不自动记录请求体、Token 或签名 URL。

## Recommended Next Step

**当前不可进入 SPEC-002 实施。**

1. 先将本报告 6 个 Blocking Issues 归入一个或多个窄范围修复 SPEC：优先 AUTH-001/002、FLOW-001、REPORT-001；DATA-001 与 ANALYSIS-001 应作为质量指标/分析正确性门禁同时关闭。
2. 修复后执行六身份 list/detail/write 授权回归、检测关系完整性 API 回归、报告并发不可变性回归、Dashboard 业务口径测试和零方差分析测试，并在 Node 20 CI + 临时 PostgreSQL 上通过完整门禁。
3. 然后完成 SPEC-001-C：恢复 Windows Node 20 本地验证；核实 C-2C-3B CI；确认 legacy 资产实际处置；固化 Railway migration/deploy 证据；同步 SPEC、Issue、Testing 和 Closure。
4. 只有 Blocking Issues 已关闭且 SPEC-001-C Closure 有可复核证据后，才创建/批准 SPEC-002 Quality Template Management。报告来源选择与 Analysis Result identity 应另建独立 SPEC，不隐式塞入 SPEC-002。

## Verification Record

- `git status --short`：审计开始时内层仓库 clean。
- 当前版本：`270a9a5 docs: finalize handoff specification`；`git describe --tags --always HEAD` 为 `v0.1.0-spec001-handoff`。
- 本地 Node 20 / npm 验证：**Not Run / Blocked**。现有权威文档记录 Windows 仅有 Node `v22.17.0` 且 Docker Linux Engine 未运行；本次版本探测未获得可用输出，因此未执行 `npm ci`、Prisma validate/generate、typecheck、test、lint、build 或 dev，也未把既有 CI/Railway 证据冒充本地结果。
- 既有 CI 证据（仅文档核对）：C-2A、C-2C-2、C-2C-3A 记录为 PASS；C-2C-3B 最终 CI 证据为 UNKNOWN/Pending；未联网重新验证 GitHub/Railway 外部状态。
- 最终 `git diff --check`：PASS（无输出）；另对未跟踪的新 Review 文件执行等价 whitespace check。
