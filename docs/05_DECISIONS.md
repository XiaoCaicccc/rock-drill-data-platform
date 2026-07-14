# 架构与权限决策

## DEC-001: Data Scope Authorization Model

状态：Accepted  
来源：SPEC-001-A，实施提交 3434faa

### 决策

受控查询资源使用角色访问权 + Data Scope 两层模型：

- requireDataScopeResource(resource) 在 API 入口读取服务端 Session、验证角色是否可访问资源，并返回 Data Scope；
- 各 API 在构造 Prisma 查询前，将 Scope 转为 where 条件；
- 页面可根据角色隐藏无权操作，但最终授权只能由后端执行。

| 资源 | API | 可访问角色 |
| --- | --- | --- |
| Dashboard | /api/dashboard | admin、quality_manager、inspector、viewer |
| 检测台账 | /api/inspections | admin、quality_manager、inspector |
| 参数分析 | /api/analysis/param-comparison | admin、quality_manager、inspector |
| 导出 | /api/export | admin、quality_manager |
| 分析报告 | /api/reports | admin、quality_manager、inspector、engineer |

### 原因

1. 前端隐藏无法阻止用户直接访问 API，因此不构成安全边界。
2. 授权必须发生在数据库查询之前，才能避免已读取越权数据后再过滤。
3. Scope 必须通过 Prisma where 或等价 SQL 条件执行；内存过滤和前端过滤都可能泄露数据、产生性能问题或造成导出与页面不一致。
4. 同一资源的列表、导出、分析和报表必须复用权限和筛选契约，避免页面看到 A、导出拿到 B。

### 实施约束

- 匿名请求返回 401。
- 已登录但无资源访问权返回 403。
- viewer 的 Dashboard 仅返回聚合统计，不能查询或返回设备健康、最近检测、待办详情。
- 低权限角色的报告查询必须在 Prisma where 中限制为已发布状态。

## DEC-002: Permission Decision Freeze

状态：Accepted  
来源：SPEC-001-A 评审与 Release Review

| 冲突 | 初始任务描述 | 冻结 SPEC 决定 | 最终选择 | 理由 |
| --- | --- | --- | --- | --- |
| engineer 对 Dashboard | dashboard_only | 403 | 403 | engineer 仅消费已发布工程结论，不应访问质量运营统计或明细。 |
| inspector 对 Export | 可导出 | 403 | 403 | 导出是独立的数据外带动作，不因可访问台账而自动授予。 |

### 长期规则

后续每个涉及权限的 SPEC 必须在编码前冻结角色 - 资源 - 动作 - 范围矩阵。页面访问、资源读取、字段/状态可见性、写操作、导出和审批发布必须分别定义。

如任务说明、实现建议和已冻结 SPEC 冲突，以已冻结 SPEC 为准；需要改变决策时必须新开 SPEC。

## DEC-003: Report Lifecycle Data Layer Freeze

状态：Accepted
来源：SPEC-001-B Closure，2026-07-14

### 决策

- 第一版报告状态固定映射为：`draft` = 草稿、`reviewing` = 审核中、`published` = 已发布。
- `analysis_report.status` 第一版继续使用 String，不强制转换为 enum；历史“已归档”数据保持可读，但不进入新状态流转。
- 历史已发布报告不自动补造发布快照；新发布报告必须创建一对一 `analysis_report_snapshot`。
- 发布状态更新、快照创建和 `PUBLISH` 审计写入必须在同一数据库事务内完成。

### 原因

在不改写历史报告的前提下，建立新发布报告的最小可追溯边界；任一步失败回滚可避免“已发布但无快照或无审计”的不一致状态。

### 影响

报告生命周期服务、发布 API、审计日志和发布快照均必须遵守本决策；后续引入归档或报告版本时需通过新 SPEC 重新评估。
