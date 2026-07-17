# SPEC-001-D 安全加固最终关闭审查（Security Hardening Final Closure Review）

- Review 日期：2026-07-16
- Review 对象：`AUTH-001`、`AUTH-002`
- Review 结论：**Implementation 已接受 / Runtime Verification 延后 / Closure 等待运行时证据**

## Review 范围

本次 Review 按 `SPEC-001-D Security Hardening` 的冻结规则和 Closure Requirement，对以下内容执行最终只读审计：

- 服务端是否以数据库中的当前用户状态作为最终授权身份；
- 旧 JWT claim、已停用用户、角色降权与升权的处理；
- 检测列表、详情、导出、分析的资源权限与 Data Scope；
- 六身份 API 回归测试；
- 自动化测试、typecheck、lint 与 GitHub Actions 证据；
- Railway 或目标运行环境的必要运行时验证记录。

审计基于指定 Review / Handoff / Current State 文档、commit `f9b9f8f` 的相关源码和测试，以及 GitHub Actions Run `29491840228`。未修改源码、SPEC 或 migration。

## 审查证据

### 源码与授权证据

- `src/lib/permissions.ts` 的 `requireAuth()` 只从 session 读取 `user.id`，随后通过 `db.user.findUnique()` 查询当前 `id`、`role`、`organization_id` 和 `active`，并调用 `resolveAuthoritativeUser()` 生成授权身份。
- `src/lib/authoritative-user.ts` 对不存在或 `active = false` 的当前用户返回 `null`；返回的角色与组织来自当前数据库记录，而非 JWT 中的旧 claim。
- 所有经 `requireRole()`、`requireDataScopeContext()`、`requireDataScopeResource()` 和 `requireOwnershipOrAdmin()` 的受保护授权均先经过上述 `requireAuth()`。
- 检测列表与详情均在业务查询前调用 `requireDataScopeResource('inspection_ledger')`；详情已不再调用 `requireAuth()` + `requireOwnershipOrAdmin()` 的独立 owner/admin 旁路。
- 导出调用 `requireDataScopeResource('export')`；分析调用 `requireDataScopeResource('param_analysis')`。冻结角色矩阵仍为：检测/分析允许 `admin`、`quality_manager`、`inspector`，导出仅允许 `admin`、`quality_manager`。
- 列表、详情、导出和分析都把解析后的 scope 转换为 Prisma `where` 或等价数据库查询条件；未发现读取全量检测数据后再按身份过滤的实现。

### 测试证据

- `tests/security-hardening.test.ts` 包含已停用用户旧 session、过期 JWT 角色降权/升权、真实 Route Handler 调用、六身份矩阵以及列表/详情/分析查询条件断言。
- 六身份为 `admin`、`quality_manager`、`inspector`、`engineer`、`viewer`、已停用用户；覆盖列表、详情、导出、分析。测试预期 `engineer` / `viewer` 对四个入口均为 403，已停用用户均为 401，`inspector` 对导出为 403。
- `package.json` 的 `npm test` 明确包含 `tests/security-hardening.test.ts`。四个测试文件共声明 35 个测试，其中安全加固测试 8 个。

### 验证证据

| 验证项 | 结论 | 证据 |
| --- | --- | --- |
| `npm test` | PASS（35/35） | 仓库共声明 35 个测试；Closure 记录 35/35，GitHub Actions 的 `Run automated tests` 步骤成功。 |
| `npm run typecheck` | PASS | GitHub Actions `TypeScript check` 步骤成功。 |
| `npm run lint` | PASS | GitHub Actions `Lint` 步骤成功。 |
| GitHub Actions Run `29491840228` | PASS | Run 状态 `completed / success`，commit 为 `f9b9f8fbf3e6a1585b122a956270acb417f889de`；verify job 及 test、typecheck、lint、build 等步骤均成功。 |

GitHub Actions 只使用临时 PostgreSQL。现有文档明确说明 CI 不连接 Railway 或生产数据库，因此该 Run 不能替代 SPEC 要求的目标运行环境验证。

## AUTH-001 结论

**CLOSED（代码和自动化验证完成）**

已确认：

- 服务端权威用户检查已生效；
- JWT 中旧 `role`、`active`、`organizationId` 不再作为最终授权依据；
- 已停用用户的旧 session 在受保护 API 被拒绝；
- 角色降权/升权已有 helper 级测试和 Route Handler 级旧 session 测试证据，授权按数据库当前角色执行。

`AUTH-001` 的代码实现和自动化验证已经完成，因此本项标记为 `CLOSED`。目标运行环境的验证尚未完成，但这是 SPEC-001-D 整体 Closure 的待补证据，不表示 `AUTH-001` 代码失败。

## AUTH-002 结论

**CLOSED（代码和自动化验证完成）**

已确认：

- 检测列表、详情、导出、分析使用冻结矩阵对应的统一资源权限入口；
- 详情不再通过 owner/admin 独立授权旁路；
- 六身份测试存在，并直接调用实际 Route Handler 验证返回码；
- Data Scope 在业务读取前解析，并进入各入口的 Prisma 查询条件或等价数据库条件。

`AUTH-002` 的代码实现和自动化验证已经完成，因此本项标记为 `CLOSED`。六身份及四个入口的目标运行环境验收记录仍待补充，但这只使 SPEC-001-D 整体 Closure Pending，不表示 `AUTH-002` 代码失败。

## 剩余风险

1. **Closure 等待证据——Runtime Verification 已延后。** 未发现 SPEC-001-D 修复版本部署至 Railway 或其他目标运行环境后，对已停用用户旧 session、角色降权/升权，以及六身份列表/详情/导出/分析矩阵的验收记录。该状态表示运行时证据尚未取得，不表示代码或自动化验证失败。
2. 自动化 API 测试通过模块替换使用数据库 mock，可证明 Route Handler 的授权入口、状态码和查询条件构造，但不能单独证明生产 NextAuth session、Prisma/PostgreSQL 与部署环境组合行为。
3. `docs/review/SPEC-001-D-CLOSURE.md` 已记录 `AUTH-001 CLOSED` / `AUTH-002 CLOSED`，与代码实现和自动化验证事实一致；Closure Requirement 第 5 项的 Runtime Verification 仍作为 SPEC-001-D 整体 Closure 的待补证据。
4. 本结论仅审查 `AUTH-001` / `AUTH-002`。`FLOW-001`、`REPORT-001`、`DATA-001`、`ANALYSIS-001` 仍按原 Review Decision 阻塞 SPEC-001 整体 Closure。

## 最终结论

**Implementation 已接受**

**Runtime Verification 已延后**

**Closure 等待运行时证据**

`AUTH-001` 与 `AUTH-002` 的代码修复、六身份自动化授权回归和指定 GitHub Actions 验证均满足要求，两项均为 `CLOSED`。SPEC-001-D 整体 Closure 仍 Pending，因为 Runtime Verification 尚未完成。

剩余阻塞项：

- 将 commit `f9b9f8f`（或包含同等修复的后续 commit）部署到 Railway 或批准的目标运行环境；
- 在该环境复核已停用用户旧 session、角色降权/升权；
- 在该环境复核六身份对检测列表、详情、导出、分析的冻结矩阵与 401 / 403 行为；
- 记录可追溯的部署版本、环境、时间、测试身份、请求入口、预期/实际状态码和结果。

完成并记录上述运行时验证后，可补齐 SPEC-001-D 的 Runtime Evidence，并重新评估其整体 Closure；无需重新打开已经基于代码和自动化验证关闭的 `AUTH-001`、`AUTH-002`。
