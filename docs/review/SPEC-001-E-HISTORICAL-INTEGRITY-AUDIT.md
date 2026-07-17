# SPEC-001-E 历史数据完整性只读审计

- 审计日期：2026-07-17（Asia/Shanghai）
- Git 基线 Commit：`f39923e`（`fix SPEC-001-E postgres test lint`）
- 审计目标：SPEC-001-E Closure Requirement 的历史数据完整性证据
- 实际数据库环境：**无法连接 Railway production；本地 PostgreSQL 亦不可用**
- 生产历史审计状态：**BLOCKED / NOT RUN**
- 总体结论：**尚未满足 SPEC-001-E 历史审计证据要求**

## 1. 开始前基线

开始审计前执行：

```text
git status --short
?? docs/review/SPEC-001-E-PHASE-6-VERIFICATION.md

git log -1 --oneline
f39923e fix SPEC-001-E postgres test lint
```

工作区中仅存在上一阶段尚未提交的 Phase 6 验证证据文档；本次未修改该文件。

## 2. 实际数据环境与覆盖边界

本次环境识别结果：

| 环境 | 可用性 | 本次用途与边界 |
| --- | --- | --- |
| Railway production | **不可连接** | 本地没有 Railway CLI、项目关联、目标数据库 host 或只读数据库凭据，未执行任何生产查询。 |
| 本地数据库 | **不可连接** | `.env` 仅指向 `localhost:5432/rock_drill`；TCP 连接检查失败，本机没有可用 PostgreSQL/Docker service。 |
| CI 临时数据库 | **未用于历史审计** | GitHub Actions PostgreSQL 16 是迁移和 integration test 的临时数据库，不包含生产历史数据，不能作为生产历史审计证据。 |

本次没有把本地种子数据、测试 fixture 或 CI 临时数据库结果用于推断生产历史。未读取或输出密码、完整 `DATABASE_URL`、Token 或其他凭据。

## 3. 四类历史异常审计结果

由于 Railway production 和目标数据库均不可访问，下列四类生产数据查询全部为 **NOT RUN**。`N/A` 表示没有取得可计算的生产结果，不表示 0，也不表示 PASS。

| 审计项 | 状态 | 异常总数 | 受影响检测记录数 | 最多 10 条脱敏示例标识 | 结论 |
| --- | --- | ---: | ---: | --- | --- |
| 同一检测记录内重复 `(record_id, part_revision_id, param_item_id)` | **NOT RUN** | N/A | N/A | N/A | 无法判断生产历史是否存在重复 tuple。 |
| `inspection_data_item.part_id` 与 `part_revision.part_id` 不一致 | **NOT RUN** | N/A | N/A | N/A | 无法判断生产历史派生 part identity 是否一致。 |
| 零件类别与 parameter template 类别不一致 | **NOT RUN** | N/A | N/A | N/A | 无法判断生产历史 category/template 关系是否一致。 |
| 检测时点不存在符合时间谓词的 equipment installation | **NOT RUN** | N/A | N/A | N/A | 无法根据生产装配历史判断 inspection 时点 eligibility。 |

未对任何异常执行自动修复、删除、回填或状态变更。

## 4. 经 Review 的只读查询方法

以下查询用于解除阻塞后在目标 PostgreSQL 数据库执行。查询均为静态参数化兼容 SQL，不包含动态标识符、字符串拼接、unsafe Prisma API 或数据写入。建议由具备最小 `SELECT` 权限的只读账号，在同一 `REPEATABLE READ READ ONLY` Transaction 中执行，以获得一致审计快照。

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

示例标识通过 PostgreSQL `MD5` 截断为 12 位审计 token，不输出原始业务 ID。每类查询分为 summary 和最多 10 条 example。

### 4.1 重复 measurement tuple

Summary：`anomaly_total` 为所有冲突组中的 item 总数；`duplicate_excess_total` 为超出每组首条之外的重复 item 数。

```sql
WITH duplicate_groups AS (
  SELECT
    record_id,
    part_revision_id,
    param_item_id,
    COUNT(*)::bigint AS occurrence_count
  FROM inspection_data_item
  GROUP BY record_id, part_revision_id, param_item_id
  HAVING COUNT(*) > 1
)
SELECT
  COALESCE(SUM(occurrence_count), 0)::bigint AS anomaly_total,
  COALESCE(SUM(occurrence_count - 1), 0)::bigint AS duplicate_excess_total,
  COUNT(DISTINCT record_id)::bigint AS affected_record_count
FROM duplicate_groups;
```

Examples：

```sql
SELECT
  LEFT(MD5(record_id), 12) AS record_token,
  CASE
    WHEN part_revision_id IS NULL THEN '<null>'
    ELSE LEFT(MD5(part_revision_id::text), 12)
  END AS revision_token,
  LEFT(MD5(param_item_id), 12) AS parameter_token,
  COUNT(*)::bigint AS occurrence_count
FROM inspection_data_item
GROUP BY record_id, part_revision_id, param_item_id
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC, record_token, revision_token, parameter_token
LIMIT 10;
```

### 4.2 item.part_id 与 revision.part_id 不一致

Summary：

```sql
SELECT
  COUNT(*)::bigint AS anomaly_total,
  COUNT(DISTINCT idi.record_id)::bigint AS affected_record_count
FROM inspection_data_item AS idi
JOIN part_revision AS pr
  ON pr.id = idi.part_revision_id
WHERE idi.part_id <> pr.part_id;
```

Examples：

```sql
SELECT
  LEFT(MD5(idi.record_id), 12) AS record_token,
  LEFT(MD5(idi.id), 12) AS item_token,
  LEFT(MD5(idi.part_revision_id::text), 12) AS revision_token,
  LEFT(MD5(idi.part_id), 12) AS stored_part_token,
  LEFT(MD5(pr.part_id), 12) AS revision_part_token
FROM inspection_data_item AS idi
JOIN part_revision AS pr
  ON pr.id = idi.part_revision_id
WHERE idi.part_id <> pr.part_id
ORDER BY record_token, item_token
LIMIT 10;
```

### 4.3 零件类别与 parameter template 类别不一致

Summary：

```sql
SELECT
  COUNT(*)::bigint AS anomaly_total,
  COUNT(DISTINCT idi.record_id)::bigint AS affected_record_count
FROM inspection_data_item AS idi
JOIN part_revision AS pr
  ON pr.id = idi.part_revision_id
JOIN part AS p
  ON p.id = pr.part_id
JOIN parameter_item AS pi
  ON pi.id = idi.param_item_id
JOIN parameter_template AS pt
  ON pt.id = pi.template_id
WHERE p.category_id <> pt.category_id;
```

Examples：

```sql
SELECT
  LEFT(MD5(idi.record_id), 12) AS record_token,
  LEFT(MD5(idi.id), 12) AS item_token,
  LEFT(MD5(idi.part_revision_id::text), 12) AS revision_token,
  LEFT(MD5(idi.param_item_id), 12) AS parameter_token,
  LEFT(MD5(p.category_id), 12) AS part_category_token,
  LEFT(MD5(pt.category_id), 12) AS template_category_token
FROM inspection_data_item AS idi
JOIN part_revision AS pr
  ON pr.id = idi.part_revision_id
JOIN part AS p
  ON p.id = pr.part_id
JOIN parameter_item AS pi
  ON pi.id = idi.param_item_id
JOIN parameter_template AS pt
  ON pt.id = pi.template_id
WHERE p.category_id <> pt.category_id
ORDER BY record_token, item_token
LIMIT 10;
```

### 4.4 检测时点 installation eligibility 不成立

使用与 SPEC-001-E 冻结规则相同的时间谓词：

```text
installed_at <= inspection_date
AND (removed_at IS NULL OR removed_at > inspection_date)
```

Summary：

```sql
SELECT
  COUNT(*)::bigint AS anomaly_total,
  COUNT(DISTINCT ir.id)::bigint AS affected_record_count
FROM inspection_data_item AS idi
JOIN inspection_record AS ir
  ON ir.id = idi.record_id
WHERE idi.part_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM equipment_part_installation AS epi
    WHERE epi.equipment_id = ir.equipment_id
      AND epi.part_revision_id = idi.part_revision_id
      AND epi.installed_at <= ir.inspection_date
      AND (epi.removed_at IS NULL OR epi.removed_at > ir.inspection_date)
  );
```

Examples：

```sql
SELECT
  LEFT(MD5(ir.id), 12) AS record_token,
  LEFT(MD5(idi.id), 12) AS item_token,
  LEFT(MD5(COALESCE(ir.equipment_id, '<null>')), 12) AS equipment_token,
  LEFT(MD5(idi.part_revision_id::text), 12) AS revision_token,
  ir.inspection_date
FROM inspection_data_item AS idi
JOIN inspection_record AS ir
  ON ir.id = idi.record_id
WHERE idi.part_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM equipment_part_installation AS epi
    WHERE epi.equipment_id = ir.equipment_id
      AND epi.part_revision_id = idi.part_revision_id
      AND epi.installed_at <= ir.inspection_date
      AND (epi.removed_at IS NULL OR epi.removed_at > ir.inspection_date)
  )
ORDER BY ir.inspection_date, record_token, item_token
LIMIT 10;
```

完成全部查询后结束只读快照：

```sql
ROLLBACK;
```

`ROLLBACK` 仅结束只读 Transaction；上述流程不执行 `INSERT`、`UPDATE`、`DELETE`、`UPSERT`、DDL、Migration 或 `prisma db push`。

## 5. 可选唯一约束决策

评估对象：

```text
(record_id, part_revision_id, param_item_id)
```

本轮默认且实际决定：**不新增唯一约束，不创建 Migration。**

由于生产重复 tuple 查询为 NOT RUN，本次没有证据能够诚实支持以下任一数据结论：

- A：存在历史冲突；
- B：数据中未发现冲突。

因此，本轮不能伪造选择 A 或 B。最终 A/B 决策保持 **BLOCKED**，待生产只读审计取得结果后只能按以下规则作出：

- 若发现任一历史重复 tuple：选择 **A. 不建议当前增加约束；存在历史冲突，需独立数据修复方案**；
- 若生产查询结果为 0：选择 **B. 数据中未发现冲突，但仍作为可选加固项；需要单独批准后才能新增 Migration**。

即使未来结果为 B，也不得在本审计任务中直接增加约束；必须另行批准新的 Prisma Migration，并评估 nullable `part_revision_id` 的 PostgreSQL unique 语义及正式历史数据影响。

## 6. 环境限制与解除阻塞条件

当前阻塞原因：

1. 没有 Railway production project/environment/database 的只读访问路径；
2. 没有目标数据库 host 或可用的最小权限只读凭据；
3. 本地 PostgreSQL 端口不可达，且本地库即使恢复也不能自动代表生产历史；
4. CI PostgreSQL 16 仅包含 migration 后的临时测试数据，不能证明生产历史完整性。

解除阻塞至少需要：

1. 明确 Railway project、environment、database service，确认目标为 production；
2. 提供只读数据库连接方式，账号只授予相关表的 `SELECT` 权限；
3. 在不输出 secret 的前提下记录目标环境标识、数据库标识、审计时间与部署 commit；
4. 在同一只读一致性快照中执行第 4 节查询；
5. 将四类 summary 数量、受影响记录数和最多 10 条脱敏 token 回填本报告；
6. 根据真实 duplicate tuple 结果作出 A 或 B 决策，并单独评审任何后续修复或 Migration。

## 7. 历史审计证据要求结论

**BLOCKED / 尚未满足。**

本次完成了环境边界确认和只读查询 Review，但没有访问 Railway production，也没有取得四类生产历史异常的实际计数与脱敏示例。因此不能声明 SPEC-001-E 的历史数据完整性审计 PASS。

本报告不构成 Runtime Acceptance 或 Focused Final Review，不关闭 SPEC-001-E，不将 FLOW-001 标记为 CLOSED，也不授权任何生产数据修复、Schema 变化或 Migration。
