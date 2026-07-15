# 项目交接说明

更新时间：2026-07-15  
版本：`v0.1.0-spec001`  
版本提交：`1540b47f10e56519f9a47e25b7a8d9b7de500b19`  
分支：`main`

## 1. 交接目的

本文为后续 Codex Agent 提供 `rock-drill-data-platform` 在 `v0.1.0-spec001` 的统一接管上下文。开始工作前，应以本文件列出的权威文档和冻结决策为准，不得仅根据页面行为或早期 `worklog.md` 推断当前规格。

## 2. 产品与阶段定位

本项目是面向凿岩机质检部门的质量数据管理与分析平台，正在从部门质量数据平台向受控质量 PLM 演进。

SPEC-001 的 MVP 业务目标已经完成：

- SPEC-001-A：Data Scope Authorization，Completed / PASS；
- SPEC-001-B：Report Lifecycle Workflow，Completed / PASS；
- SPEC-001-C：System Hardening and Delivery Baseline，部分能力已 PASS，工程尾项仍为 In Progress / Non-blocking for MVP。

当前已具备设备档案、零件档案、检测参数模板、检测数据录入、检测台账、配合参数分析、导出、分析报告生命周期，以及六类身份的授权与 Data Scope 控制。

## 3. 版本锚点与仓库状态

- 标签 `v0.1.0-spec001` 与 `main` 当前均指向提交 `1540b47f10e56519f9a47e25b7a8d9b7de500b19`；
- 交接文档编写前工作区为 clean；
- 旧标签 `SPEC-001-B-PASS` 指向 SPEC-001-B 阶段基线；
- 后续 Agent 修改前必须先执行 `git status --short`，保留用户已有变更，不得使用破坏性 reset 或 checkout 覆盖工作区。

## 4. 已冻结的授权模型

受控查询使用“资源访问权 + Data Scope”两层模型：

1. API 在查询前调用 `requireDataScopeResource(resource)`；
2. Scope 必须进入 Prisma `where` 或等价 SQL 条件；
3. 禁止先查询全量数据，再在内存或前端过滤；
4. 前端隐藏按钮只改善体验，不构成安全边界；
5. 匿名请求返回 401，已登录但无资源权返回 403。

| 资源 | 可访问角色 | 关键限制 |
| --- | --- | --- |
| Dashboard | `admin`、`quality_manager`、`inspector`、`viewer` | `viewer` 仅聚合统计，不返回受控明细；`engineer` 为 403。 |
| 检测台账 | `admin`、`quality_manager`、`inspector` | 必须在数据库查询阶段应用 Data Scope。 |
| 参数分析 | `admin`、`quality_manager`、`inspector` | 组合匹配使用记录、零件版本及参数身份。 |
| 导出 | `admin`、`quality_manager` | 导出是独立的数据外带权限；`inspector` 不因可读台账而获得导出权限。 |
| 分析报告 | `admin`、`quality_manager`、`inspector`、`engineer` | `inspector`、`engineer` 仅可读 `published`；`viewer` 为 403。 |

权限矩阵已经冻结。若新任务与 `DEC-001`、`DEC-002` 冲突，必须先创建新 SPEC，不得直接改变现有角色、资源、动作或范围。

## 5. 报告生命周期冻结规则

第一版状态机为：

```text
draft ──提交审核──> reviewing ──发布──> published
  ^                      │
  └──────退回修改────────┘
```

- 仅 `admin` 与 `quality_manager` 拥有生命周期写权限；
- 只有 `draft` 可编辑业务内容；
- `reviewing → draft` 必须记录退回原因；
- `published` 不可直接编辑、重新提交或物理删除；
- `analysis_report.status` 继续使用 String；历史“已归档”记录保持可读但不进入新状态机；
- 历史已发布报告不补造快照；新发布报告必须创建一对一 `analysis_report_snapshot`；
- 发布状态更新、快照创建和 `PUBLISH` 审计必须在同一数据库事务内完成，任一步失败整体回滚。

如需归档、报告版本、通知或复杂审批，必须进入独立 SPEC。

## 6. 已验证的交付事实

### Runtime Verification

- SPEC-001-A：Railway 环境五角色及匿名身份授权矩阵 PASS；
- SPEC-001-B：Railway production 六类身份、报告状态转换、审计日志、发布快照及边界测试 PASS；
- SPEC-001-C C-1B：报告新建/编辑弹窗在桌面 100% 缩放、低高度视口和移动端 PASS；
- SPEC-001-C C-1A-1：Dashboard 与 Dashboard Export 的待办、趋势和类别统计一致性 PASS；
- SPEC-001-C C-1A-2：检测台账搜索及台账/导出一致性 PASS。

### CI Verification

- Node 20 CI 使用临时 PostgreSQL service；
- `npm ci`、Prisma Validate、Prisma Generate、完整 `prisma migrate deploy`、TypeScript、lint 和 Next.js build 已通过；
- 报告生命周期测试 9/9 PASS；
- 参数分析组合匹配测试 8/8 PASS；对应 CI 合计 17 tests PASS；
- CI 不连接 Railway、生产数据库或历史 `prisma/dev.db`。

Static Verification、CI Verification 与 Runtime Verification 必须分别记录，不得相互替代或把未执行的本地验证写成 PASS。

## 7. 本地开发与生产边界

本地、CI 和 Docker 的 Node 基线为 `>=20.19.0 <21`。

推荐本地验证链：

```powershell
node -v
npm -v
where.exe node
where.exe npm
npm ci
npm run db:validate
npm run db:generate
npm run typecheck
npm test
npm run lint
npm run build
```

- PowerShell 若拦截 `npm.ps1`，可使用 `npm.cmd`，但仍必须有有效的 Node 20；
- 本地开发可使用 `npm run db:push`，生产环境禁止使用；
- 生产环境只使用 `npm run db:migrate`（`prisma migrate deploy`）；
- 生产禁止 HTTP `/api/setup`；
- `/api/seed` 在生产默认禁用，仅允许配置 `SEED_TOKEN` 后由管理员受控调用；
- 文档文件使用 S3 兼容对象存储，不得写入 `public/uploads`；
- README 中的种子密码只允许用于开发环境，部署后必须修改，后续文档不得复制真实凭据。

## 8. 当前开放项与非阻塞限制

### SPEC-001-C 工程尾项

- C-2B Windows Local Verification：BLOCKED。记录显示本机 Node `v22.17.0` 不符合 Node 20 基线，Docker Desktop Linux Engine 未运行；不得标记为仓库代码失败或本地 PASS；
- C-2C-3B Inspection Ledger and Export Filter Regression：已实现，仍 Pending CI Verification；
- C-2C-3C Legacy Asset Disposition：Pending；`scripts/test-param-analysis.ts`、`prisma/dev.db`、`bun.lock`、`bun-types` 尚未完成最终处置；
- SPEC-001-C 最终 Closure 尚未完成；SPEC-001 MVP 完成不等于上述事项已关闭。

### 业务与架构后续项

- `ISSUE-002` Dashboard Metric Logic Duplication 仍标记 Open。虽然 C-1A-1 已验证当前 Dashboard/导出结果一致，权威文档仍未将共享查询契约债务标记为 Resolved；接手时不得擅自关闭；
- `ISSUE-003` 台账/导出筛选契约为 Resolved、需回归；C-2C-3B CI 证据仍待补齐；
- 来源检测记录仍通过内部 `inspection_record.id` 输入，缺少按 `record_no`、零件、日期选择的业务 UI；
- `analysis_identifiers` 仅校验非空，尚无权威 `analysis_result` / `analysis_task` 实体；
- `ISSUE-005` AI Coding Agent Collaboration Discipline 为 Open，所有新 SPEC 必须执行事实核验、决策冻结、Review、Verification 与 Closure；
- `ISSUE-007` 客户检测模板兼容属于 Future SPEC-002，不阻塞 SPEC-001。

## 9. 建议接管顺序

1. 运行 `git status --short`，确认版本与用户变更；
2. 阅读 `docs/CURRENT_STATE.md`、`docs/SPEC-001-COMPLETION.md` 和相关 SPEC；
3. 若继续 SPEC-001-C，优先确认 C-2C-3B CI 结果，再决定 C-2C-3C 旧资产处置；
4. Node 20 与 Docker 恢复后执行 C-2B 完整本地验证，不使用 Node 22 代替；
5. 同步 `docs/06_ISSUES.md`、`docs/07_TESTING.md`、SPEC-001-C 与 Closure，避免验证事实分散；
6. 新业务能力必须先创建独立 SPEC 并冻结权限、数据影响、验收标准和 Out of Scope。

## 10. Agent 协作约束

- 一次 Agent 任务只处理清晰、可独立验收的范围；
- 先核对事实，再实施；不得根据用户界面推断后端授权；
- 不记录密码、Token、MFA Secret、签名 URL、生产凭据或敏感文件内容；
- 不连接或修改生产数据库来完成纯测试；
- 不使用 `prisma db push` 处理生产结构；
- 不修改冻结权限或状态机来规避测试失败；
- 修改后至少执行与风险相称的检查，并把未执行项明确写为 Pending、Blocked 或 Not Run；
- 文档 Closure 必须区分已完成事实、验证证据、已接受限制和 Future Item。

## 11. 权威文档索引

- 项目开发与运行前置条件：`README.md`；
- 当前状态：`docs/CURRENT_STATE.md`；
- SPEC-001 阶段结论：`docs/SPEC-001-COMPLETION.md`；
- 架构与权限冻结决策：`docs/05_DECISIONS.md`；
- 开放问题与后续归属：`docs/06_ISSUES.md`；
- 测试与验收证据：`docs/07_TESTING.md`；
- 具体规格与 Closure：`docs/specs/`；
- 开发流程：`docs/08_DEVELOPMENT_WORKFLOW.md`。

## 12. 已识别的信息缺口

- C-2C-3B 仅记录为 Implementation / Pending CI Verification，尚无最终 CI Run、commit 与 PASS/FAIL 证据；
- C-2C-3C 的旧资产最终保留、迁移或删除决定尚未形成；
- C-2B 缺少符合 Node 20 基线且 Docker Linux Engine 可用时的 Windows 完整验证记录；
- `ISSUE-002` 仍为 Open，但 C-1A-1 已完成当前行为一致性验收；两者分别代表“当前结果一致”与“共享契约架构债务未关闭”，后续 Closure 应保持这一区分；
- `docs/07_TESTING.md` 的 C-2C Minimum Automated Test Gate 初始段仍写 Pending，后文已补充 C-2C-2 PASS；读取时应以后续更具体的 CI 证据为准，并在最终 Closure 中统一口径。

除上述明确缺口外，SPEC-001-A、SPEC-001-B 和已完成的 SPEC-001-C 子项均已有可追溯的决策与验证记录。
