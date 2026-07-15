# SPEC-001 阶段完成记录

状态：MVP Completed  
完成日期：2026-07-15

## 1. 阶段目标

SPEC-001 以质量数据授权、报告生命周期和可重复交付基线为范围，形成质量部门可使用、可审计、可追溯的 MVP。本文汇总阶段完成事实；各子规格的冻结规则、实现范围和验证证据仍以 `docs/specs/` 下对应文档为准。

## 2. 完成范围

| 子阶段 | 状态 | 完成事实 |
| --- | --- | --- |
| SPEC-001-A Data Scope Authorization | Completed / PASS | 五角色 RBAC、资源授权和服务端 Data Scope 已落地；Railway 五角色及匿名身份验收通过。 |
| SPEC-001-B Report Lifecycle Workflow | Completed / PASS | `draft → reviewing → published` 与退回修改闭环、发布快照和审计追溯已完成；Railway 六类身份验收通过。 |
| SPEC-001-C System Hardening and Delivery Baseline | In Progress / Non-blocking for MVP | 查询与导出一致性、报告弹窗可用性、确定性构建与迁移门禁及首批自动化回归测试已通过；剩余工程尾项继续按原 SPEC 跟踪。 |

## 3. MVP 完成能力

- 受控资源在数据库查询前完成认证、资源授权和 Data Scope 解析；
- Dashboard、检测台账、参数分析、导出和报告遵循已冻结的角色与数据范围规则；
- 报告支持草稿、提交审核、退回修改和正式发布；
- 发布状态、发布快照和 `PUBLISH` 审计在同一事务中提交；
- 已发布报告保持只读，并可追溯到来源上下文和发布责任人；
- CI 已覆盖锁定依赖安装、Prisma Validate/Generate、空 PostgreSQL migration、TypeScript、测试、lint 和构建；
- Dashboard/导出、台账/导出及参数分析的关键一致性风险已进入验证或自动化回归基线。

## 4. 验证结论

### Runtime Verification

- SPEC-001-A：Railway 五角色权限矩阵及匿名 401 验收 PASS；
- SPEC-001-B：Railway 六类身份、报告状态流转、审计日志和发布快照边界验收 PASS；
- SPEC-001-C 已完成项：Dashboard/导出一致性、台账搜索/导出一致性和报告弹窗桌面/移动端可用性验收 PASS。

### Static / CI Verification

- 确定性构建与 migration gate 已通过；
- 报告生命周期与参数分析组合匹配自动化测试已通过；
- CI 不连接 Railway、生产数据库或历史 `prisma/dev.db`。

## 5. 非阻塞尾项与已接受限制

以下事项不影响 SPEC-001 MVP 完成，但不得标记为已验证或隐式并入本阶段：

- Windows Node 20 本地完整验证仍受本机环境阻塞；CI Node 20 是当前已通过的验证权威；
- SPEC-001-C 的 C-2C-3B CI 验证、C-2C-3C 旧资产处置及 C 的最终 Closure 仍按原文档继续跟踪；
- 来源检测记录仍使用内部 `inspection_record.id`，尚无业务选择器；
- `analysis_identifiers` 尚无权威 `analysis_result` / `analysis_task` 实体校验；
- 组织级多租户隔离、备份恢复、完整监控告警及更大范围 PLM 能力属于后续独立 SPEC。

## 6. 阶段结论

SPEC-001 的 MVP 业务目标已经完成：质量数据访问具备服务端授权边界，分析报告具备最小可审计生命周期，关键交付路径具备 CI 验证基线。项目可以从“建立 MVP 核心闭环”转入“完成 SPEC-001-C 工程尾项并规划下一阶段业务能力”。

本结论不关闭 SPEC-001-C 中仍明确标记为 Pending、Blocked 或 In Progress 的事项。
