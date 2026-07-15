# 开放问题

## 状态说明

- Open：尚未进入实现。
- Resolved：当前已修复，但需回归防止复发。
- Deferred：确认存在，已转入后续 SPEC。

## ISSUE-001: Report Workflow Missing Publish Action

- 类型：Future Feature
- 状态：Resolved
- 后续归属：SPEC-001-B Closure
- 描述：SPEC-001-B 已实现 `draft → reviewing → published` 与 `reviewing → draft`，并完成发布快照、审计和运行时权限验收。
- 影响：原“审核中无法发布”的阻塞已消除。
- 后续要求：归档、报告版本及通知等能力仍须通过独立 SPEC 定义。

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
- 状态：Blocked
- 后续归属：SPEC-001-C / C-2B
- 描述：Windows 本机曾出现 Node/npx 类型检查执行异常，以及 Docker Compose 的 ps、pull、up 无响应或无法拉取镜像的问题。当前已确认仅有 Node `v22.17.0`，不满足项目冻结基线 `>=20.19.0 <21`；未发现可用 Node 20，Docker Desktop Linux Engine 也未运行。
- 影响：本地无法稳定完成 TypeScript、数据库和浏览器运行验证，生产环境承担了过多验证压力。
- 后续要求：用户安装符合范围的 Node 20 并恢复 Docker Desktop 后，重新执行本地验证链；在 CI 中保留类型检查、构建和迁移检查。本项是环境前置条件，不是仓库代码失败。

## ISSUE-005: AI Coding Agent Collaboration Discipline

- 类型：Process Improvement
- 状态：Open
- 后续归属：所有新 SPEC
- 描述：本次交付确认 AI 适合实现、静态审查辅助和文档整理，但不能替代需求判断、权限决策和最终验收。
- 影响：若跳过事实核验和语义冻结，AI 容易将冲突需求直接固化为代码，造成返工。
- 后续要求：执行 [开发流程](./08_DEVELOPMENT_WORKFLOW.md)：事实核验、SPEC 冻结、小范围实现、人工 Review、运行时验收、Closure。

## ISSUE-006: Analysis report dialog cannot scroll within viewport

- 等级：P1
- 类型：Existing Usability Defect
- 状态：Resolved
- 发现环境：Railway production
- 后续归属：SPEC-001-C / C-1B
- 描述：分析报告新建/编辑弹窗内容超过浏览器视口时，桌面端 100% 缩放下无法访问完整表单与底部操作按钮，需缩小页面比例；移动端弹窗内容无法正常滚动。
- 影响：阻断报告新建和编辑，影响既有报告生命周期入口的实际可用性。
- 范围边界：仅处理弹窗滚动与响应式可用性；不涉及权限、状态机、报告字段、API 或数据模型变更。
- 验证：修复版本已部署 Railway；桌面端与移动端运行时验证均通过；不涉及权限、API、Schema 或 Migration。

## ISSUE-007: Customer Inspection Template Compatibility

- 等级：P2
- 类型：Future Feature
- 状态：Open
- 后续归属：Future SPEC-002
- 背景：客户提供真实的大齿轮检测记录模板、柄体 1 检测模板，用于未来质量模板能力分析。
- 影响：当前系统可继续使用既有检测参数模板；客户模板中的字段组织、记录版式及适用规则尚未形成受控的质量模板管理能力。
- 范围边界：不阻塞 SPEC-001-C；不修改 SPEC-001-A 当前数据模型、权限规则或既有检测流程。
- 后续要求：通过独立 SPEC 定义 Quality Template Management 的模板结构、适用范围、版本与发布规则，以及导入/输出兼容边界。
