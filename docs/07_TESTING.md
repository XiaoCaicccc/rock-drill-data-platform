# 测试与验收

## SPEC-001-A Runtime Verification

### 环境与范围

- 测试环境：Railway 部署环境。
- 验收对象：3434faa feat: implement SPEC-001-A data scope authorization。
- 测试方式：真实登录账号访问页面/API，并检查允许/拒绝行为和返回内容。
- 密码：不记录在文档中。

### Static Verification

Static Verification 是对真实仓库当前实现和 3434faa diff 的源码审查，不等同于运行验证。

审查覆盖：

- src/lib/permissions.ts
- /api/dashboard
- /api/inspections
- /api/analysis/param-comparison
- /api/export
- /api/reports
- LedgerView 的导出筛选传递和检测删除入口移除

审查结论：

- 所有目标查询 API 在查询前调用 requireDataScopeResource()；
- 角色无资源访问权时返回 403，未登录时返回 401；
- 报告的低权限可见性在 Prisma where 中限制为已发布；
- viewer 的 Dashboard 不查询设备健康和最近检测明细；
- 导出 API 在后端独立授权，前端按钮不构成安全边界；
- 未发现检测记录 DELETE API。

### Runtime Verification

| Role | Purpose | Dashboard | Inspection | Analysis | Export | Reports | Recorded result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin | 系统最高权限 | 200，全量 | 200，全量 | 200 | 200 | 200，全部状态 | PASS |
| quality_manager | 质量域负责人 | 200 | 200 | 200 | 200 | 200，质量域完整报告 | PASS |
| inspector | 一线检测人员 | 200 | 200 | 200 | 403 | 200，仅已发布 | PASS |
| engineer | 工程结论消费者 | 403 | 403 | 403 | 403 | 200，仅已发布 | PASS |
| viewer | 只读统计审阅 | 200，仅统计 | 403 | 403 | 403 | 403 | PASS |
| unauthenticated | 匿名访问 | 401 | 401 | 401 | 401 | 401 | PASS |

### 关键验收场景

- viewer：确认没有设备健康、最近检测、待办详情等受控明细。
- inspector：直接访问导出 API 仍被 403 拒绝；报告只包含已发布。
- engineer：不能借由前端路由或 API 访问 Dashboard、台账、分析或导出。
- admin、quality_manager：可完成各自质量域内的预期查询和导出。

### 后续测试规则

任何新增受控资源的 SPEC 必须定义：

- Test environment；
- Test account：仅记录 role、purpose、scenario，不记录密码；
- Steps；
- Expected result：状态码、页面行为和关键返回字段；
- Evidence：截图、日志、测试输出或部署记录。

Static Verification 与 Runtime Verification 必须分开记录。

## SPEC-001-B Runtime Verification

状态：PASS
验收日期：2026-07-14
环境：Railway production；Build、Deploy 与 Prisma Migration 均成功。

### 六类身份验收矩阵

| 身份 | `GET /api/reports` | 生命周期写接口 | 实际结果 |
| --- | --- | --- | --- |
| `admin` | 200，全部报告 | 创建、编辑、提交审核、退回、发布均允许 | PASS |
| `quality_manager` | 200，全部质量报告 | 创建、编辑、提交审核、退回、发布均允许 | PASS |
| `inspector` | 200，仅 `published` | 403 | PASS |
| `engineer` | 200，仅 `published` | 403 | PASS |
| `viewer` | 403 | 403 | PASS |
| `anonymous` | 401 | 401 | PASS |

### 已验证流程与证据

- 已验证：创建草稿、编辑来源上下文、提交审核、退回修改、再次提交、发布和查看发布报告。
- `audit_log` 已验证：`LOGIN`、`CREATE`、`UPDATE`、`SUBMIT_REVIEW`、`RETURN_FOR_REVISION`、`PUBLISH`。
- `analysis_report_snapshot` 已存在；发布状态、快照和 `PUBLISH` 审计在同一事务完成。
- 边界测试均通过：已发布报告禁止修改、禁止重新提交、删除仅限草稿、发布快照保持不变。

## SPEC-001-C C-1B Runtime Verification

状态：PASS
环境：Railway production；修复版本已部署。

| 验收场景 | 结果 |
| --- | --- |
| 桌面浏览器 100% 缩放 | PASS：完整表单与底部操作按钮可访问。 |
| 低高度桌面视口 | PASS：表单内容在弹窗内部纵向滚动。 |
| 移动端视口 | PASS：无横向溢出，可完成滚动与操作。 |
| 新建报告 | PASS。 |
| 编辑草稿 | PASS。 |

本次仅修复报告弹窗滚动与响应式可用性；权限、API、Schema、Migration、Data Scope 和报告生命周期均未改变。

## SPEC-001-C C-1A-1 Runtime Verification

状态：PASS
环境：Railway production。

| 验收场景 | 结果 |
| --- | --- |
| `admin` 登录 | PASS：Dashboard 与 Dashboard Export 的待办事项统计一致。 |
| `quality_manager` 登录 | PASS：质量统计、月度趋势与 Dashboard Export 一致；待办事项保持既有质量范围规则。 |
| 月度趋势 | PASS：数据、月份标签和排序一致。 |
| 类别统计 | PASS：类别统计排序一致。 |

本项未修改 Schema、Migration、权限模型或 Data Scope；`GET /api/dashboard` 的 response shape 保持不变。

## SPEC-001-C C-1A-2 Runtime Verification

状态：PASS
环境：Railway production。

| 角色 | 验收场景 | 结果 |
| --- | --- | --- |
| `admin` | 零件编码、零件名称、检测编号、检测员、批次搜索 | PASS。 |
| `admin` | 零件名称/编码筛选后的台账与导出结果一致 | PASS。 |
| `admin` | 组合筛选、空结果处理、原有搜索能力 | PASS。 |
| `quality_manager` | 零件名称、零件编码搜索；检测台账与导出 | PASS。 |
| `quality_manager` | 权限与 Data Scope 保持既有规则 | PASS。 |

本项未修改 Prisma Schema、Migration、权限模型、Data Scope、分页或 API 返回结构；检测台账与检测导出继续使用同一搜索契约。

## SPEC-001-C C-2A CI Verification

状态：PASS
环境：GitHub Actions 临时 PostgreSQL service，workflow `ci: add deterministic build and migration gates`（2026-07-14）。

| 验证项 | 结果 |
| --- | --- |
| 临时 PostgreSQL service 健康启动 | PASS |
| `npm ci` | PASS |
| Prisma Schema Validate | PASS |
| Prisma Client Generate | PASS |
| 空 PostgreSQL 执行完整 `prisma migrate deploy` | PASS |
| TypeScript Check | PASS |
| Lint | PASS |
| Next.js Build | PASS |

该工作流的 `DATABASE_URL` 仅指向 GitHub Actions 临时 PostgreSQL；未连接 Railway 或生产数据库，未使用 `prisma db push`。本记录仅证明 CI 门禁；Railway 最新 Docker Build、Deploy 与基础访问需在实际生产部署后单独记录。

## SPEC-001-C C-2B Local Verification

状态：BLOCKED
环境：Windows 本机，2026-07-15。

- 已确认当前 Node 为 `v22.17.0`，不满足项目冻结范围 `>=20.19.0 <21`；未发现可用 Node 20；
- 因此未执行 `npm ci`、Prisma Validate/Generate、TypeScript、lint、build 或 `dev`；未将 Node 22 作为替代验证环境；
- Docker Desktop Linux Engine 未运行，Compose 服务与本地开发服务也未验证；
- 本记录不代表仓库代码失败。待用户安装 Node 20 并恢复 Docker 后，必须从 `npm ci` 开始重新执行完整 Windows 验证链，完成前 C-2B 不得标记 PASS。

## SPEC-001-C C-2C Minimum Automated Test Gate

Status: Implementation / Pending CI Verification.

- Test command: `npm test`, using locked `tsx` and Node built-in `node:test`; it exits after one run and returns non-zero on failures.
- Coverage: legal `draft -> reviewing`, `reviewing -> draft`, and `reviewing -> published` transitions; direct draft publishing, published rollback/reviewing, legacy archived, and unknown states are rejected.
- Isolation: tests call real rules in `src/lib/report-workflow.ts`; they do not request Railway, connect to a production database, or use `prisma/dev.db`.
- CI runs `npm test` after TypeScript and before lint. GitHub Actions on Node 20 is the PASS authority; local Windows execution remains pending Node 20 installation.

## SPEC-001-C C-2C-2 CI Verification

Status: PASS for C-2C-2 only.
Environment: GitHub Actions Node 20, Run `29381888019`.

- Command: `tsx --test tests/report-workflow.test.ts` through `npm test`;
- Result: 9 tests passed, 0 failed; the TAP process completed normally without a Prisma Client import hang;
- Prisma Validate, Prisma Generate, temporary PostgreSQL Migration Apply, TypeScript, lint, and build all passed;
- The tests do not connect to Railway, a production database, or `prisma/dev.db`.

### Non-blocking CI warnings

- Existing ESLint warnings (3), Next.js middleware convention deprecation and build warnings, GitHub Actions Node 20 action-runtime deprecation, and temporary PostgreSQL locale/trust notices were recorded. They did not block this CI run and are not C-2C-2 failures;
- Their treatment belongs to later, scoped maintenance work. This record does not close C-2C-3, C-2B, or SPEC-001-C.

## C-2C-3A Parameter Analysis Regression Gate

**Status**: CI Verification PASS.

- Test entry: `tests/parameter-analysis.test.ts` through `npm test`.
- It calls the same pure matching rule used by `GET /api/analysis/param-comparison`.
- Coverage verifies matching requires the record id, part revision id, and selected parameter pair; record-only and cross-revision matches are rejected.
- Missing or empty revision ids are excluded and cannot pollute known-version matches.
- This test is isolated from Prisma, Railway, production credentials, and `prisma/dev.db`.

### CI evidence

- Commit `d4b473b`, GitHub Actions Run `29383992320`, Node 20 CI environment.
- `npm test` ran both explicit files: 17 tests passed, 0 failed; parameter-analysis 8/8 and report-workflow 9/9.
- Prisma Validate, Prisma Generate, temporary PostgreSQL Migration Apply, TypeScript, lint, and build passed. The test process exited normally.
- The test is a pure regression gate: it does not connect to Railway, a production database, or `prisma/dev.db`.
- Existing non-blocking warnings remain recorded in the C-2C-2 CI section. C-2C-3B, C-2C-3C, C-2C overall, C-2B, and SPEC-001-C are not closed by this result.
