# SPEC-001-E Phase 6 验证证据

> This is a historical Phase 6 verification snapshot. Its earlier pre-Closure status is retained as historical evidence and superseded for current status by [SPEC-001-E Formal Closure](./SPEC-001-E-CLOSURE.md).

- 验证日期：2026-07-17（Asia/Shanghai）
- 验证范围：SPEC-001-E Phase 6 PostgreSQL Integration 与并发验证
- 验证基线 Commit：`f39923e`
- UUID cast 修复 Commit：`b25ba81`
- GitHub Actions Run：[`29562638268`](https://github.com/XiaoCaicccc/rock-drill-data-platform/actions/runs/29562638268)
- Phase 6 结论：**PASS**
- SPEC-001-E 状态：**尚未 Closure**
- FLOW-001 状态：**OPEN / 尚未关闭**

## 1. 验证基线与 CI 结果

本次 Phase 6 的可复核验证基线为 commit `f39923e`。该提交包含前一轮 commit `b25ba81` 的 PostgreSQL UUID 参数类型修复，以及 PostgreSQL integration test 中不影响测试逻辑的 lint 变量重命名。

GitHub Actions Run `29562638268` 在该基线上完成，Workflow 总体结果为 **PASS**：

| 验证项 | 结果 | 证据摘要 |
| --- | --- | --- |
| PostgreSQL 16 service | **PASS** | CI 启动真实 `postgres:16-alpine` service，并通过数据库 health check。 |
| Prisma Schema validation / client generation | **PASS** | `Validate Prisma schema` 与 `Generate Prisma client` 步骤成功。 |
| Prisma Migration | **PASS** | 在临时 PostgreSQL 数据库执行 `prisma migrate deploy`，`Apply migrations to temporary PostgreSQL` 步骤成功。 |
| Typecheck | **PASS** | `npm run typecheck` 成功。 |
| Automated tests | **PASS（113/113）** | `Run automated tests` 步骤成功，包含四个真实 PostgreSQL 场景。 |
| Lint | **PASS** | `npm run lint` 成功。 |
| Build | **PASS** | `npm run build` 成功。 |
| CI Workflow | **PASS** | Run `29562638268` 的 verify job 完成并成功。 |

## 2. PostgreSQL 环境与 Migration

真实数据库验证运行于 GitHub Actions 的 Node.js 20 项目测试环境，数据库为 PostgreSQL 16 Alpine service。CI 使用独立临时数据库，并在运行测试前执行仓库现有 migration：

1. 启动 PostgreSQL 16 service；
2. 通过 `pg_isready` health check；
3. 安装锁定依赖并生成 Prisma Client；
4. 执行 `prisma migrate deploy`；
5. 在已迁移的真实 PostgreSQL 数据库上运行自动化测试。

本阶段未使用 SQLite 或其他数据库替代品，未修改 Prisma Schema，未新增或修改 Migration。

## 3. 真实 PostgreSQL 场景证据

### 3.1 Concurrent installation removal

- 验证目的：证明 installation removal 与 batch 写入使用同一 equipment 行作为串行化点；先完成的 removal 提交后，等待中的 batch 必须在 Transaction 内重新读取权威 installation 状态。
- 验证行为：removal writer 在真实 PostgreSQL Transaction 中取得同一 equipment `FOR UPDATE`，更新 installation 并在 commit 前通过 barrier 保持锁；batch 等待该 equipment lock，随后继续执行 installation lock 与 eligibility 重校验。
- 预期结果：已在检测时点移除的 revision 不得产生 inspection commit；`inspection_record = 0`、`inspection_data_item = 0`、成功 audit `= 0`。
- 实际结果：**PASS**。
- 结论：未产生非法 inspection commit，Transaction 内重校验有效。

### 3.2 Concurrent installation replacement

- 验证目的：证明 batch 与 replacement writer 共享 equipment lock，且锁顺序保持为 `equipment -> installation`。
- 验证行为：使用确定性 barrier 让 batch 在取得 equipment lock 后等待 installation lock；replacement writer 随后尝试取得同一 equipment lock，并必须等待 batch 完成。
- 预期结果：batch 在其合法快照下提交一个 record、一个 item 和一个成功 audit；replacement 只能在 equipment lock 释放后按相同顺序继续。
- 实际结果：**PASS**。
- 结论：父 equipment 锁形成共同串行化点，replacement 未跨越冻结锁顺序。

### 3.3 Rollback atomicity

- 验证目的：证明多 item batch 中任意 item 失败时，record、items 和成功 audit 全部回滚。
- 验证行为：同一 batch 包含一个合法 item 和一个 category/template 不匹配 item，在真实 PostgreSQL Serializable Transaction 中执行完整 Service 路径。
- 预期结果：返回冻结的业务完整性错误，且 `inspection_record = 0`、`inspection_data_item = 0`、成功 audit `= 0`。
- 实际结果：**PASS**。
- 结论：batch 写入与 audit 保持同一 Transaction 的全有或全无语义。

### 3.4 Concurrent record_no allocation

- 验证目的：证明两个并发 batch 使用 `count + 1` 生成候选 `record_no` 时，不会产生两个重复成功记录。
- 验证行为：对同一 equipment 并发执行两个完整 batch；由 equipment lock、Serializable Transaction 和冻结的冲突重试共同处理竞争。
- 预期结果：两个成功记录具有不同 `record_no`，各自仅有一个 item 和一个成功 audit，不存在 duplicate success。
- 实际结果：**PASS**。
- 结论：当前并发协议下 `record_no` 分配未产生重复成功。

## 4. UUID/text 类型故障与修复

首次真实 PostgreSQL CI 暴露了 PostgreSQL `42883`：UUID 数据库列与 Prisma 绑定的 text 参数直接比较时，PostgreSQL 不存在 `uuid = text` 运算符。受影响位置包括：

- `equipment_part_installation.part_revision_id`：Prisma Schema 为 `String @db.Uuid`；
- `equipment_part_installation.id`：Prisma Schema 为 `String @id @db.Uuid`。

根因不是数据库 Schema 错误，而是参数化 raw SQL 未显式声明绑定参数的 PostgreSQL UUID 类型。Commit `b25ba81` 采用以下窄修复：

- UUID 单值比较使用参数绑定并显式 `::uuid` cast；
- UUID 集合查询对每个绑定参数使用 `::uuid`，继续通过 `Prisma.sql` 与 `Prisma.join` 组合；
- 保留参数化查询，没有使用 `$queryRawUnsafe`、`$executeRawUnsafe` 或 SQL 字符串拼接；
- `equipment.id` 在 Prisma Schema 中是普通 `String`/text，因此保持 text 参数比较，不错误地 cast 为 UUID；
- 未把数据库 UUID 列改为 text，未修改 Schema 或 Migration。

修复后，四个真实 PostgreSQL 场景全部通过。

## 5. Retry 验证证据

Service retry 测试覆盖冻结的三类可重试错误：

| 错误 | 验证结果 |
| --- | --- |
| PostgreSQL `40001` serialization failure | **PASS** |
| PostgreSQL `40P01` deadlock detected | **PASS** |
| Prisma `P2034` transaction conflict | **PASS** |

每类错误均验证：

- 只对冻结的 retryable error 重新执行完整 Transaction；
- 最大尝试次数为 3；
- 确定性退避测试覆盖前两次 retry 的 `25ms`、`75ms` 边界路径；
- sleep/backoff 执行时不存在活动的 interactive Transaction，即退避期间不持有数据库锁；
- 第三次仍失败时统一转换为 `CONCURRENT_MODIFICATION`；
- retry 成功路径重新执行完整 Transaction，且只提交一个 record 和一个成功 audit；
- `record_no` 唯一冲突进入同一受限重试流程，不产生重复成功。

## 6. 本地与 CI 验证边界

本地 Windows 环境没有可用的 Docker/PostgreSQL runtime，项目 `.env` 指向的 `localhost:5432` 无数据库服务。因此四个真实数据库场景在本地为 **NOT RUN**，不得解释为本地 PASS 或 FAIL。

本地可执行的非数据库验证结果为：

- `npm.cmd run typecheck`：PASS；
- `npm.cmd run lint`：PASS；
- 非数据库 SPEC-001-E tests：PASS；
- `git diff --check`：PASS。

Phase 6 的真实 PostgreSQL PASS 证据仅来自 commit `f39923e` 对应的 GitHub Actions Run `29562638268`：Node.js 20 项目测试环境、PostgreSQL 16 service、已执行现有 migration 的临时数据库。该 CI 证据不可替代后续目标环境 Runtime Acceptance。

## 7. Phase 6 与 Closure 结论

**SPEC-001-E Phase 6：PASS。**

该结论证明 PostgreSQL integration、冻结并发锁协议、rollback atomicity、retry 边界与 `record_no` 并发行为已在真实 PostgreSQL 16 CI 环境通过验证。

**SPEC-001-E 尚未 Closure，FLOW-001 不得提前标记 CLOSED。**

进入 SPEC-001-E Closure 前仍需完成：

1. 历史完整性只读审计；
2. 目标环境 Runtime Acceptance；
3. Focused Final Review。

本文件仅记录 Phase 6 验证证据，不构成 SPEC-001-E Closure 决定，也不改变 FLOW-001 当前状态。
