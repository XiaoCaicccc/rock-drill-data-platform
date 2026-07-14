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
