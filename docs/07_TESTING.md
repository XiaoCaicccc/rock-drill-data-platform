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
