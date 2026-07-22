# 当前项目状态

更新时间：2026-07-16

## 产品定位

rock-drill-data-platform 是面向凿岩机质检部门的质量数据管理与分析平台，正在从部门质量数据平台向受控质量 PLM 演进。

## Milestone

### M1 Authorization Foundation

状态：Completed

Achievement：

- RBAC：admin、quality_manager、inspector、engineer、viewer；
- Data Scope：角色与资源访问权分离，统一由服务端解析；
- API authorization：Dashboard、检测台账、参数分析、导出、报告已接入查询前授权；
- Runtime verification：Railway 环境五角色验收已记录为通过；
- Documentation closure：SPEC-001-A 的决策、验证、问题和流程已归档。

详情见 [SPEC-001-A Closure](./specs/SPEC-001-A-CLOSURE.md)。

### M2 Report Lifecycle Workflow

状态：Completed

Achievement：

- 报告生命周期已形成 `draft → reviewing → published`，并支持 `reviewing → draft` 退回修改；
- 仅 `admin` 与 `quality_manager` 拥有生命周期写权限；`inspector` 与 `engineer` 仅读取已发布报告；
- 发布在同一事务内完成状态更新、发布快照与 `PUBLISH` 审计写入；
- Railway production 已完成六类身份运行时验收并通过。

详情见 [SPEC-001-B Closure](./specs/SPEC-001-B-CLOSURE.md)。

### SPEC-001 MVP Completion

状态：Functional Complete

Achievement：

- SPEC-001-A 已完成 Data Scope 授权闭环，SPEC-001-B 已完成报告生命周期闭环；
- 质量部门 MVP 已具备受控查询、检测台账、参数分析、导出和可审计报告发布能力；
- SPEC-001-C 已完成查询/导出一致性、报告弹窗可用性、确定性 CI 与 migration gate，以及首批自动化回归测试；
- SPEC-001-C 尚未完成的 Windows Node 20 本地验证、C-2C-3B CI 验证和旧资产处置继续跟踪，不影响 MVP 业务完成，但不得标记为 PASS。
- 核心业务功能已实现，但 SPEC-001 Closure 当前被 Review Audit 阻塞。

阶段完成记录见 [SPEC-001 Completion](./SPEC-001-COMPLETION.md)。

## SPEC-001-D Security Hardening

状态：Implementation Completed / Security Findings Closed

- AUTH-001：CLOSED。Server-side authoritative user check 已实现，自动化验证通过，CI 通过。
- AUTH-002：CLOSED。inspection detail 已统一 resource authorization，六身份 API 回归通过，CI 通过。

Runtime Verification：Deferred / Blocked

原因：缺少 Railway 目标环境验证条件，尚未取得目标部署版本与实际运行行为证据。该阻塞表示运行时验证条件不足，不表示代码或自动化验证失败。因此 SPEC-001-D 当前不标记为完全 Closed。

## Review Status

状态：SPEC-001-E CLOSED WITH ACCEPTED RISKS；SPEC-001 overall OPEN

原因：

SPEC-001 Review Audit Remaining Blocking Issues：

- FLOW-001 → SPEC-001-E Inspection Business Integrity
- REPORT-001 → SPEC-001-F Report Publication Consistency
- DATA-001 + ANALYSIS-001 → SPEC-001-G Quality Metrics Correctness

## SPEC-001-F Report Publication Consistency

Phase 2 status update: **COMPLETE** for the report mutation service and service-level tests. Route integration and PostgreSQL concurrency evidence remain pending. REPORT-001 remains **OPEN / BLOCKING**.

- SPEC-001-F: **PHASE 2 IMPLEMENTED / ROUTE INTEGRATION NOT STARTED**
- REPORT-001: **OPEN / BLOCKING**
- Phase 0 Current-State Audit: **COMPLETE**
- Phase 1 Design Freeze: **COMPLETE**
- Phase 2 implementation: **NOT STARTED**
- Frozen design: existing `analysis_report.updated_at` optimistic CAS, required `expected_updated_at` for edit/delete, lifecycle status plus timestamp CAS, Current Row authoritative reads, immutable publication snapshot evidence, and no Migration.
- No production business code, tests, Prisma Schema, Migration, workflow, production data, or Railway settings were changed by the design-freeze phase.

说明：

SPEC-001-E 已通过 Formal Closure 关闭并保留接受风险；SPEC-001-F、SPEC-001-G 尚未开始实施，SPEC-001 overall 仍保持 OPEN。

Review Audit 不否定 SPEC-001 MVP 的核心功能完成状态。AUTH-001、AUTH-002 已通过 SPEC-001-D 关闭；其余 Blocking Issues 不得提前标记为已修复。

## 当前冻结规则

- requireDataScopeResource() 必须在数据库查询前执行。
- 数据范围必须进入 Prisma where 或等价查询条件，禁止查全量后在内存或前端过滤。
- 前端隐藏按钮仅改善体验，不能构成授权边界。
- SPEC-001-A 的角色 - 资源 - 动作矩阵已经冻结。

## Next

### SPEC-001-E Runtime Acceptance Reconciliation

- SPEC-001-E Formal Closure: **CLOSED WITH ACCEPTED RISKS**; Closure baseline `19cc4c2a58e93e9b80937d5b91a03c10ac6b6c1b`; evidence implementation CI Run `29886001299` passed on PostgreSQL 16.
- Added contract/service evidence, Batch Route mapping review, and PostgreSQL zero-residue scenarios for Failure Paths A and C; reconciled B against existing rollback evidence.
- No production business code, permissions, Batch contract, time semantics, numbering rules, Schema, Migration, production data, or production deployment was changed.
- Product Owner accepted the evidence boundary for SPEC-001-E Closure on 2026-07-22: direct Route handler automation is not implemented; contract/service tests, Route mapping review, and PostgreSQL 16 CI are the accepted combination.
- Product Owner accepted UI-01 deferral to a future approved SPEC, including its date-filtering, record-number-date, and traceability risks; existing production history must not be modified.
- Failure Paths A/B/C: **PASS under accepted evidence boundary**. Direct Route handler automation remains **NOT IMPLEMENTED**.

- Runtime Acceptance Overall: **PASS WITH ACCEPTED RISKS**; Production Manual UI Verification: **PARTIAL PASS**.
- Local Windows Failure Path Re-verification: **BLOCKED**; existing GitHub Actions PostgreSQL 16 CI: **PASS**.
- Failure-path A/B/C evidence is reconciled by accepted contract/service/Route mapping review and PostgreSQL 16 CI evidence.
- Production Mutation Lock Closure: **CLOSED**; FLOW-001: **CLOSED WITH ACCEPTED RISKS**; SPEC-001-E: **CLOSED WITH ACCEPTED RISKS**.
- This Closure does not enter SPEC-001-F or SPEC-001-G. SPEC-001-F is the next authorized stage.
- See [SPEC-001-E Runtime Acceptance](./review/SPEC-001-E-RUNTIME-ACCEPTANCE.md).

1. 来源选择器：按 `record_no`、零件、日期等业务信息选择检测记录，避免第一版手工输入内部 ID。
2. Analysis Result 实体化：建立权威分析结果对象，替代仅校验非空的 `analysis_identifiers`。
3. Shared Query Contract：收敛 Dashboard、台账、导出之间的筛选与统计口径。

## 文档一致性检查结果

- 当前仓库原先没有 docs；未发现需要迁移或合并的旧文档体系。
- worklog.md 中的早期 Spec-001 是全局布局与导航框架，并非本次 SPEC-001-A，历史状态不应被误改。
- 当前仓库未发现其他 SPEC 文档与冻结后的权限矩阵相冲突。
