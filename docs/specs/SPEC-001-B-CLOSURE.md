# SPEC-001-B 验收记录

> 本记录是 SPEC-001-B 的运行时验收与 Closure 事实来源；状态机与权限规则以已完成的 SPEC-001-B 为准。

- 状态：PASS
- 验收日期：2026-07-14
- 关联 SPEC：SPEC-001-B Report Lifecycle Workflow

## 验收范围

分析报告生命周期管理与权限控制。

## 已验证功能

### 报告生命周期

已验证主流程：

```text
CREATE → UPDATE → SUBMIT_REVIEW → 审核中 → PUBLISH
```

已验证退回修改流程：

```text
RETURN_FOR_REVISION → 草稿 → 再次提交审核
```

发布后的报告为只读，不允许直接修改或重新提交审核。

### 权限验证

已覆盖当前角色模型中的以下验收角色：

- 普通用户：`inspector`，仅查看已发布报告；
- 编辑与审核人员：`quality_manager`，可创建、编辑草稿、提交审核、退回和发布；
- 管理员：`admin`，拥有同等报告生命周期管理权限；
- 工程人员：`engineer`，仅查看已发布报告；
- 无权限用户：`viewer`，不能访问报告资源；
- 未登录用户：不能访问报告资源。

已验证创建报告、编辑报告、提交审核、审核中退回、发布及越权访问行为，结果符合 SPEC-001-B 冻结权限规则。

### 审计日志

已验证 `audit_log` 正常记录以下事件：

- `LOGIN`
- `CREATE`
- `UPDATE`
- `SUBMIT_REVIEW`
- `RETURN_FOR_REVISION`
- `PUBLISH`

报告状态转换、退回原因和发布快照标识均可通过审计记录追溯。

### 数据追溯验证

`source_context` 使用以下规范：

```json
{
  "inspection_record_ids": [
    "inspection_record.id"
  ],
  "analysis_identifiers": [
    "analysis identifier"
  ]
}
```

- `inspection_record_ids` 来源于 `inspection_record` 表主键 `id`；
- `analysis_identifiers` 来源于分析报告生成流程；
- 提交审核前必须至少包含一个来源检测记录和一个来源分析标识，否则服务端拒绝提交；
- 检测台账页面不直接展示 `analysis_identifier`，属于当前设计范围内的正常行为。

发布时会在同一事务内创建发布快照，保存报告内容摘要、来源上下文、关联零件版本、发布人和发布时间。

## 边界测试

1. 已发布报告禁止直接修改：通过。
2. 已发布报告禁止重新提交审核：通过。
3. 删除权限验证：通过；仅管理员和质量管理员可删除草稿，审核中和已发布报告不可删除。
4. 发布快照一致性验证：通过；状态更新、快照生成和 `PUBLISH` 审计记录在同一事务内完成。

## 部署验证

- Railway production 部署通过；
- PostgreSQL 正常；
- Prisma migration 正常。

## 结论

SPEC-001-B 的报告生命周期、服务端权限控制、审计追溯、发布快照和生产部署验收通过，可作为已完成的质量部门报告生命周期能力使用。

## 精确角色验收矩阵

| 身份 | 报告读取 | 生命周期操作 | 实际结果 |
| --- | --- | --- | --- |
| `admin` | 全部报告 | 可创建草稿、编辑、提交审核、退回、发布 | PASS |
| `quality_manager` | 全部质量报告 | 可创建草稿、编辑、提交审核、退回、发布 | PASS |
| `inspector` | 仅 `published` 报告 | 无生命周期写权限（403） | PASS |
| `engineer` | 仅 `published` 报告 | 无生命周期写权限（403） | PASS |
| `viewer` | 无权限（403） | 无权限（403） | PASS |
| `anonymous` | 未登录（401） | 未登录（401） | PASS |

## B-1 数据层冻结决策

- `draft` 映射为“草稿”，`reviewing` 映射为“审核中”，`published` 映射为“已发布”。
- 第一版 `status` 继续使用 String，不强制改为 enum。
- 历史“已归档”数据保持可读，不进入新的状态流转。
- 历史已发布报告不自动补造发布快照；新发布报告必须生成一对一快照。
- 发布状态更新、快照生成与 `PUBLISH` 审计日志必须在同一数据库事务内提交，任一步失败则整体回滚。

## 来源追溯限制（Accepted Limitation / Future Architecture）

- `source_context.inspection_record_ids` 保存的是 `inspection_record.id`，不是页面展示的 `record_no`。
- 当前检测台账只展示 `record_no`，普通用户无法自然取得内部 CUID；手工输入内部 ID 仅适用于验收和第一版最小实现。
- 后续应提供按 `record_no`、零件、日期等信息选择检测记录的 UI。
- 当前不存在权威的 `analysis_task` 或 `analysis_result` 实体；`analysis_identifiers` 第一版只能校验非空，无法验证其真实性。
- 上述限制归类为 Accepted Limitation / Future Architecture，不是本次报告状态机的缺陷。

## 运行时验收证据补充

- Railway Build 与 Deploy 成功，PostgreSQL 和 Prisma Migration 正常。
- 创建、编辑、提交审核、退回、再次提交与发布均已成功验证。
- `audit_log` 已验证包含：`LOGIN`、`CREATE`、`UPDATE`、`SUBMIT_REVIEW`、`RETURN_FOR_REVISION`、`PUBLISH`。
- `analysis_report_snapshot` 已存在，并通过发布快照保持不变的边界测试。
- 五个登录账号的权限验收均已通过；匿名身份的 401 行为已通过验证。
- 已通过四项边界测试：已发布报告禁止修改、已发布报告禁止重新提交、删除边界正确、发布快照保持不变。
