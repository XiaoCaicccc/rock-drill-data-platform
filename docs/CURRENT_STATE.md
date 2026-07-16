# 当前项目状态

更新时间：2026-07-15

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

## Review Status

状态：BLOCKED

原因：

SPEC-001 Review Audit 发现 6 个 Blocking Issues：

- AUTH-001
- AUTH-002
- FLOW-001
- REPORT-001
- DATA-001
- ANALYSIS-001

说明：

这些问题需要通过独立修复 SPEC 关闭后，才能重新执行 Closure。

Review Audit 不否定 SPEC-001 MVP 的核心功能完成状态，但相关问题不得标记为已修复。

## 当前冻结规则

- requireDataScopeResource() 必须在数据库查询前执行。
- 数据范围必须进入 Prisma where 或等价查询条件，禁止查全量后在内存或前端过滤。
- 前端隐藏按钮仅改善体验，不能构成授权边界。
- SPEC-001-A 的角色 - 资源 - 动作矩阵已经冻结。

## Next

1. 来源选择器：按 `record_no`、零件、日期等业务信息选择检测记录，避免第一版手工输入内部 ID。
2. Analysis Result 实体化：建立权威分析结果对象，替代仅校验非空的 `analysis_identifiers`。
3. Shared Query Contract：收敛 Dashboard、台账、导出之间的筛选与统计口径。

## 文档一致性检查结果

- 当前仓库原先没有 docs；未发现需要迁移或合并的旧文档体系。
- worklog.md 中的早期 Spec-001 是全局布局与导航框架，并非本次 SPEC-001-A，历史状态不应被误改。
- 当前仓库未发现其他 SPEC 文档与冻结后的权限矩阵相冲突。
