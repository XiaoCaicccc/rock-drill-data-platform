# SPEC-001-E Target Runtime Acceptance

## Failure Path Evidence Reconciliation

Static reconciliation baseline: `main` HEAD `c9a7a0b6d2089a20ee296613d846fd20ce2f606d`; GitHub Actions Run `29674174594`. The CI workflow uses `postgres:16-alpine`, sets `DATABASE_URL`, applies migrations, and runs `npm test`. Existing GitHub Actions PostgreSQL 16 CI: **PASS**. Local Windows Failure Path Re-verification: **BLOCKED**; no further local environment troubleshooting was attempted.

| Scenario | Test file and exact test name | Level | Exact HTTP status asserted | Exact business code asserted | Zero `inspection_record` | Zero `inspection_data_item` | Zero successful CREATE audit | Real PostgreSQL 16 | Run 29674174594 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A. Missing RFC3339 timezone offset | `tests/spec-001-e-contract.test.ts` — `timestamp rejects a date-time without an offset`; `tests/spec-001-e-service.test.ts` — parameterized `service rejects ${name} without trusting caller validation` | contract / service | No | Yes: `INVALID_REQUEST` | Service mock only; no real PG residue proof | Service mock only; no real PG residue proof | Service mock has `writes.audits === 0` | No dedicated PG scenario | Included in `npm test`; no dedicated PG scenario | **PARTIAL** |
| B. Duplicate `(part_revision_id, param_item_id)` | `tests/spec-001-e-contract.test.ts` — `batch rejects a duplicate normalized revision and parameter tuple`; `tests/spec-001-e-service.test.ts` — `service rejects a duplicate tuple before opening a transaction`; `tests/spec-001-e-postgres.test.ts` — `a rejected multi-item batch rolls back record, items, and success audit` | contract / service / PostgreSQL integration | No route-level assertion found | Yes: `DUPLICATE_MEASUREMENT` | PG expected `committedRecords: 0` | PG expected `committedItems: 0` | PG expected `successAudits: 0` | Yes, through CI `postgres:16-alpine` | Yes | **PARTIAL** |
| C. Installation invalid at inspection time | `tests/spec-001-e-service.test.ts` — `business integrity rejects a revision that is not installed`; `business integrity rejects a revision installed on another equipment`; `business integrity rejects an installation removed at the inspection instant` | service | No | Yes: `INSTALLATION_NOT_ELIGIBLE` | Mock fixture only; no dedicated PG residue proof | Mock fixture only; no dedicated PG residue proof | Failure-path mock has no audit write | No dedicated PG scenario for these inputs | Service tests included in `npm test`; no dedicated PG scenario | **PARTIAL** |

### Failure-path requirement mapping

- A: contract/service evidence proves rejection and no mocked writes, but not the complete HTTP 400 plus real PostgreSQL zero-residue chain. **OPEN**.
- B: code, service no-write behavior, and PostgreSQL 16 atomic rollback counts are evidenced; route HTTP 409 is not asserted by the identified tests. **OPEN**.
- C: service rejection cases and code are evidenced; corresponding PostgreSQL 16 zero-residue integration evidence is not identified. **OPEN**.
- Service mocks are not treated as PostgreSQL evidence. Error-code assertions are not treated as exact HTTP-status assertions.

## Production Manual UI Verification

Result: **PARTIAL PASS**

Completed manual page verification covered five-role permission and account-switch isolation; unauthenticated access and logout session invalidation; successful Inspector and Quality Manager record creation; cross-creator reads by Admin, Inspector, and Quality Manager; Engineer and Viewer access restrictions; export permission and filtered export; batch number, record number, date, and combined filters; empty data, invalid characters, zero values, metadata, dates, and equipment switching; historical installation-time filtering; and the absence of edit/delete entry points for inspection records.

The following production records are permanently retained and were not cleaned up:

- `JC-20260719-001`
- `JC-20260719-002`
- `JC-20260719-003`
- `JC-20260719-003` with batch number `S1E-QM-20260720-01`

These are permanent production acceptance records. No cleanup is to be performed, no existing production history is to be modified, and no new successful production test record is to be created for this reconciliation.

## Deferred Issues

All issues below are **Deferred to a future approved SPEC**:

| ID | Issue | Status |
| --- | --- | --- |
| UI-01 | Detection business date is offset by one day | **Known business defect; High priority; OPEN** |
| UI-02 | Future-date submission failure has no page feedback | Deferred to a future approved SPEC |
| UI-03 | Inspection ledger has no detail entry point | Deferred to a future approved SPEC |
| UI-04 | Audit log has no frontend entry point | Deferred to a future approved SPEC |
| UI-05 | Inspector field is editable but has no effective behavior | Deferred to a future approved SPEC |
| UI-06 | Missing inspection date message is inaccurate | Deferred to a future approved SPEC |
| UI-07 | Historical-time unavailable-installation message is inaccurate | Deferred to a future approved SPEC |
| UI-08 | Inspector can see the export button | Deferred to a future approved SPEC |
| UI-09 | Engineer can enter the ledger shell but sees only empty results | Deferred to a future approved SPEC |
| UI-10 | Horizontal table usability is poor with 247 parameters | Deferred to a future approved SPEC |
| UI-11 | Menu pages do not have independent URLs | Deferred to a future approved SPEC |
| UI-12 | Back navigation after logout shows a cached page shell | Deferred to a future approved SPEC |
| UI-13 | Search does not support equipment number and does not explain search scope | Deferred to a future approved SPEC |

UI-01 additionally involves frozen business time semantics and record-number dates. Whether SPEC-001-E may close with this defect requires explicit risk acceptance during Closure; recording deferral is not risk acceptance. UI-01 must not be marked PASS, Fixed, or Resolved.

## Final Status

- Production Manual UI Verification: **PARTIAL PASS**
- Local Windows Failure Path Re-verification: **BLOCKED**
- Existing PostgreSQL 16 CI: **PASS**
- Production Mutation Lock Closure: **OPEN**
- Runtime Acceptance Overall: **FAIL**
- FLOW-001: **OPEN**
- SPEC-001-E: **OPEN**

- 验收日期：2026-07-17（Asia/Shanghai）
- Railway environment：`production`
- 应用公开域名：`rock-drill-data-platform-production.up.railway.app`
- Railway 部署 commit：`3547c96e8cc50ec84467338242e9f700d717be38`
- Runtime Acceptance Overall：**FAIL**
- Historical Integrity Audit：**PASS**
- Production Mutation Lock Closure：**OPEN**
- SPEC-001-E：**OPEN**
- FLOW-001：**OPEN**

## 1. 部署基线

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| Railway 部署成功 | **PASS** | Railway production deployment 显示 Active、Deployment successful；应用与 Postgres service 均为 Online。 |
| 部署包含 SPEC-001-E Implementation | **PASS** | 当前 commit `3547c96e8cc50ec84467338242e9f700d717be38` 是 `f39923e` 的后继提交，包含 `3fbd1e4`、`b25ba81`、`f39923e`。 |
| 应用健康 | **PASS** | 公开域名可访问，Next.js 应用正常呈现。 |
| 登录正常 | **PASS（admin）** | 现有专用管理员会话可进入应用和检测录入页。未记录任何凭据、Cookie 或 Token。 |

CI Run `29562638268` 与 Phase 6 PASS 仅作为实施背景，没有被当作 Runtime PASS。

## 2. Runtime 主流程

测试备注统一使用：`SPEC-001-E-RUNTIME-VERIFICATION`。

| 场景 | 结果 | Runtime 证据 |
| --- | --- | --- |
| admin 可以使用检测录入主流程 | **PASS** | 设备 discovery `200`；装配 discovery `200`；category parameter discovery `200`；batch `201`。 |
| quality_manager 可以使用检测录入主流程 | **BLOCKED / NOT RUN** | 当前浏览器仅提供 admin 会话；本机环境变量和未跟踪配置未提供该角色凭据。未伪造 session。 |
| inspector 可以使用检测录入主流程 | **BLOCKED / NOT RUN** | 当前浏览器仅提供 admin 会话；本机环境变量和未跟踪配置未提供该角色凭据。无法证明 inspector 使用非本人或 `created_by = null` 数据的 Runtime 行为。 |
| engineer 的三个 entry API 与 batch 为 `403` | **BLOCKED / NOT RUN** | 无 engineer 专用登录会话或本机凭据。 |
| viewer 的三个 entry API 与 batch 为 `403` | **BLOCKED / NOT RUN** | 无 viewer 专用登录会话或本机凭据。 |
| anonymous 的三个 entry API 与 batch 为 `401` | **PASS** | 在独立未登录浏览器会话中直接请求三个 discovery API 与 batch，四个响应均为 `401`。 |

### 2.1 admin 主流程证据

- 设备：`ZYT-2024-001`（COP1838ME）。
- equipment discovery：`200`，返回 2 台设备。
- 有效装配 discovery：`200`，按当前带 offset 的 inspection time 返回 6 个有效装配零件版本。
- category parameter discovery：密封件 category 返回 `200`、43 个参数；UI 合并加载 6 个零件、247 个类别参数。
- batch：`201`，创建 1 个 measurement item。
- 测试记录 `record_no`：`JC-20260717-001`。
- 检测台账：按 `record_no` 查询返回 `200`，命中 1 条记录。
- 测试角色：admin。
- 执行日期：2026-07-17（Asia/Shanghai）。

测试记录属于专用演示流程，未删除或修改任何正式质量记录。

## 3. 失败路径抽样

| 场景 | 结果 | 是否创建 record |
| --- | --- | --- |
| `inspection_date` 不带 offset | **PASS**：`400 INVALID_REQUEST` | 响应无 record。 |
| 重复 measurement tuple | **PASS**：`409 DUPLICATE_MEASUREMENT` | 响应无 record。 |
| 检测时点早于目标版本安装时间 | **PASS**：`409 INSTALLATION_NOT_ELIGIBLE` | 响应无 record。 |

失败请求使用独立 batch 标记。响应均未返回检测记录。数据库残留聚合复核在 Railway Data UI 重连阶段未取得稳定结果表，因此 `inspection_record`、`inspection_data_item`、success audit 三项数据库级零残留证据标记为 **BLOCKED**，不能仅凭错误响应宣称原子回滚 Runtime PASS。

## 4. 生产路由锁协议静态核验

结论：**FAIL / 存在生产实现缺口**。

实际生产入口追踪结果：

| 生产 mutation | equipment `FOR UPDATE` | installation `FOR UPDATE` | 事务内重读校验 | business + audit 同事务 | 结果 |
| --- | --- | --- | --- | --- | --- |
| `POST /api/inspections/batch` | 是 | 是，按稳定 id 顺序 | 是 | 是 | **PASS** |
| `PUT /api/equipment` | 否 | 否 | 否 | 否；equipment update 与 audit 分离 | **FAIL** |
| `DELETE /api/equipment` | 否 | 否 | 否；installation count 在事务外 | 否；delete 与 audit 分离 | **FAIL** |
| `POST /api/equipment/[id]/installations`（含 replace） | 否 | 否 | 否；revision/equipment 读取在事务外 | 否；installation transaction 与 audit 分离 | **FAIL** |
| `PUT /api/equipment/[id]/installations`（remove） | 否 | 否 | 否 | 否；update 与 audit 分离 | **FAIL** |

证据定位：

- `src/lib/inspection-integrity-service.ts` 的 batch 路径执行 equipment row `FOR UPDATE`，随后 installation rows `FOR UPDATE`，并在同一 Serializable transaction 内重读 user/revision/parameter、校验时点关系、创建 record/items 和 success audit。
- `src/app/api/equipment/route.ts` 的 PUT/DELETE 使用普通 Prisma 查询和 mutation，没有共享 row-lock helper 或 transaction；audit 在 mutation 后单独执行。
- `src/app/api/equipment/[id]/installations/route.ts` 的 POST transaction 只执行 installation `updateMany/create`，没有 equipment/installation row lock，且 audit 在 transaction 外；PUT remove 甚至没有 transaction。

因此 Phase 6 scenario/helper 的并发测试不能证明实际 equipment 与 installation mutation 已接入冻结的共同锁协议。本缺口足以使 Runtime Acceptance 判定为 FAIL。

## 5. Runtime 结论

**FAIL**

部署基线、admin 主流程、anonymous 401 与三条错误 contract 已取得真实 Railway Runtime 证据；但生产 equipment/installation mutation 未接入 batch 使用的同一 equipment-first 锁协议，且相关 audit 未与业务 mutation 保持同一事务。另有四个角色场景和失败请求数据库级残留复核仍 BLOCKED / NOT RUN。

Historical Integrity Audit 已取得 **PASS**，但“历史异常为 0”只描述只读一致性快照，不证明未来并发 mutation 安全，也不能消除本报告确认的 production route 锁协议缺口。

本报告不进入 Final Closure Review，不关闭 SPEC-001-E，不将 FLOW-001 标记为 CLOSED。
