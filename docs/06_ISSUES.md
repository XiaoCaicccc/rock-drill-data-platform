# 开放问题

## 状态说明

- Open：尚未进入实现。
- Resolved：当前已修复，但需回归防止复发。
- Deferred：确认存在，已转入后续 SPEC。

## ISSUE-001: Report Workflow Missing Publish Action

- 类型：Future Feature
- 状态：Deferred
- 后续归属：Report Workflow SPEC
- 描述：报告数据中存在草稿、审核中、已发布状态样例，但当前报告 API 的状态转换只覆盖草稿 -> 已发布 -> 已归档。审核中没有审核中 -> 已发布发布入口，界面也没有面向该状态的发布动作。
- 影响：审核中的报告无法按预期完成发布闭环；状态展示与状态机实现不一致。
- 后续要求：先定义提交审核、审核通过、拒绝退回、发布、撤回和审计规则，再开发页面与 API。

## ISSUE-002: Dashboard Metric Logic Duplication

- 类型：Architecture Debt
- 状态：Open
- 后续归属：Shared Query Contract / Reporting SPEC
- 描述：/api/dashboard 与 /api/export?type=dashboard 分别维护统计与聚合逻辑，存在指标口径分叉风险。
- 影响：同一时期 Dashboard 和导出文件可能出现不同统计数字，影响质量数据可信度。
- 后续要求：抽取共享查询服务或统一聚合契约，并针对同一筛选条件建立回归测试。

## ISSUE-003: Export and Ledger Filter Contract

- 类型：Bug / Consistency Fix
- 状态：Resolved，需回归
- 后续归属：Shared Query Contract / Regression Tests
- 描述：历史实现中，检测台账与导出使用不同筛选参数，存在页面看到 A、导出拿到 B 的风险。SPEC-001-A 已将前端应用筛选传给 /api/export，并在导出 API 支持 search、categoryId、result、startDate、endDate 及历史别名。
- 影响：已降低当前不一致风险，但未来新增筛选项时仍可能重新分叉。
- 后续要求：将筛选 schema 和查询构造提取为共享模块，补充列表/导出结果一致性测试。

## ISSUE-004: Local Verification Environment

- 类型：Dev Environment
- 状态：Open
- 后续归属：Developer Experience / CI
- 描述：本地曾出现 Node/npx 类型检查执行异常，以及 Docker Compose 的 ps、pull、up 无响应或无法拉取镜像的问题。
- 影响：本地无法稳定完成 TypeScript、数据库和浏览器运行验证，生产环境承担了过多验证压力。
- 后续要求：独立修复 Node PATH/终端上下文和 Docker Desktop/Compose 网络问题；在 CI 中保留类型检查、构建和迁移检查。

## ISSUE-005: AI Coding Agent Collaboration Discipline

- 类型：Process Improvement
- 状态：Open
- 后续归属：所有新 SPEC
- 描述：本次交付确认 AI 适合实现、静态审查辅助和文档整理，但不能替代需求判断、权限决策和最终验收。
- 影响：若跳过事实核验和语义冻结，AI 容易将冲突需求直接固化为代码，造成返工。
- 后续要求：执行 [开发流程](./08_DEVELOPMENT_WORKFLOW.md)：事实核验、SPEC 冻结、小范围实现、人工 Review、运行时验收、Closure。
