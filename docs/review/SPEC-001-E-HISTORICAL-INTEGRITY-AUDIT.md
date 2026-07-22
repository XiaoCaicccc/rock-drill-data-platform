# SPEC-001-E 历史生产数据完整性只读审计

> This is a historical audit snapshot. Its earlier OPEN conclusions are retained as historical facts and superseded for current status by [SPEC-001-E Formal Closure](./SPEC-001-E-CLOSURE.md).

- 审计日期：2026-07-17（Asia/Shanghai）
- Git 基线：Railway production commit `3547c96e8cc50ec84467338242e9f700d717be38`
- 目标环境：Railway production PostgreSQL
- 事务：`REPEATABLE READ READ ONLY`
- 结束方式：显式 `ROLLBACK`
- 总体结论：**PASS**
- Production Mutation Lock Closure：**OPEN**
- SPEC-001-E：**OPEN**
- FLOW-001：**OPEN**

## 1. 安全边界

审计通过 Railway production Postgres Data UI 执行。没有输出或记录 `DATABASE_URL`、密码、Token 或其他凭据。所有查询均在同一 `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` 快照中执行，完成后显式 `ROLLBACK`。

未执行 INSERT、UPDATE、DELETE、UPSERT、DDL、Migration、seed、清表、自动修复或生产结构变更。

本审计只回答“该一致性快照中的既有历史记录是否存在四类已定义异常”，不验证未来并发 mutation 是否安全，也不证明实际 production mutation route 已使用统一锁协议。CI 临时数据库、测试 fixture 和本地数据均未用于推断生产历史。

## 2. 审计范围与判定方法

审计覆盖以下关系链：

```text
inspection_record
  -> inspection_data_item
  -> part_revision -> part -> part_category
  -> parameter_item -> parameter_template
  -> equipment_part_installation
```

四类判定口径：

1. 同一 inspection record 内，`(record_id, part_revision_id, param_item_id)` 出现超过一次即为重复 measurement tuple；同时统计异常 item 总数、超额重复数和受影响 record 数。
2. 对所有非空 revision 关联，持久化的 `inspection_data_item.part_id` 必须等于 `part_revision.part_id`。
3. measurement 使用的 part category 必须等于 parameter item 所属 template 的 category。
4. 对所有具有 revision 的历史 measurement，在 inspection time 必须存在同一 equipment 与 revision 的有效 installation，权威谓词为 `installed_at <= inspection_date AND (removed_at IS NULL OR removed_at > inspection_date)`。

每类查询均返回 summary 和最多 10 个 example。example 中的业务 ID 使用 `LEFT(MD5(id), 12)` 脱敏；本次异常均为 0，因此 example 均为空数组。

## 3. 审计结果

| 异常类别 | 异常总数 | 受影响记录数 | 最多 10 个脱敏示例 | 结果 |
| --- | ---: | ---: | --- | --- |
| 重复 `(record_id, part_revision_id, param_item_id)` tuple | 0 | 0 | `[]` | **PASS** |
| `inspection_data_item.part_id` 与 `part_revision.part_id` 不一致 | 0 | 0 | `[]` | **PASS** |
| 零件 category 与 parameter template category 不一致 | 0 | 0 | `[]` | **PASS** |
| 检测时点不存在有效 equipment installation | 0 | 0 | `[]` | **PASS** |

重复 tuple 的额外统计 `duplicate_excess_total` 亦为 0。

脱敏示例查询使用 `LEFT(MD5(id), 12)` token；由于四类结果均为 0，没有输出任何真实业务 ID 或明细。

## 4. 查询语义

审计使用报告既有查询语义：

- duplicate tuple 按 `record_id, part_revision_id, param_item_id` 分组并筛选 `COUNT(*) > 1`；
- part identity 通过 inspection item 与 part revision 关联后比较 `part_id`；
- category identity 通过 revision → part 与 parameter item → template 两条链路比较 `category_id`；
- installation eligibility 使用冻结谓词：

```text
installed_at <= inspection_date
AND (removed_at IS NULL OR removed_at > inspection_date)
```

## 5. 唯一约束 A/B 决策

选择 **B**：生产历史数据中未发现重复 measurement tuple。

该结论仅证明当前只读一致性快照中没有历史冲突，不授权在本任务新增唯一约束。若后续决定数据库加固，仍必须单独批准新的 Prisma Migration，并评估 nullable `part_revision_id` 的 PostgreSQL unique 语义和生产部署影响。

## 6. 长期边界与非结论

- 历史异常为 0 不等于未来并发安全；Production Mutation Lock Closure 仍为 **OPEN**。
- 历史异常为 0 不等于应立即创建数据库唯一约束；任何约束仍需独立设计、审批、回填评估和新 Migration。
- 本审计不验证 Runtime 角色矩阵、失败请求 rollback 残留或 production route 锁接入。
- 本审计不改变权限矩阵、Batch contract、时间解析语义、错误 code 或 `record_no` 规则。
- 本审计没有删除或修改任何正式质量记录。

## 7. 历史审计结论

**PASS**

四类历史异常均为 0，且只读事务已回滚。没有自动修复数据，也没有修改 Schema、Migration 或生产数据库结构。

该 PASS 仅解除 SPEC-001-E 的历史生产数据完整性审计阻塞，不构成 Runtime Acceptance PASS、Focused Final Review 或 Closure；SPEC-001-E 尚未 Closure，FLOW-001 尚未 CLOSED。

## 附录 A：只读审计 SQL

以下 SQL 记录本次审计的可复核方法。执行边界为：

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

全部 summary/example 查询完成后执行：

```sql
ROLLBACK;
```

### A.1 重复 measurement tuple

Summary：

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

### A.2 item.part_id 与 revision.part_id 不一致

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

### A.3 part category 与 parameter template category 不一致

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

### A.4 inspection time installation eligibility 不成立

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

附录 SQL 只用于保存审计判定方法，不授权后续自动执行、数据修复或 Schema/Migration 变更。
