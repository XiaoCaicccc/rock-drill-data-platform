# SPEC-001-D Security Hardening Final Closure Review

- Review 日期：2026-07-16
- Review 对象：`AUTH-001`、`AUTH-002`
- Review 结论：**Implementation Accepted / Runtime Verification Deferred / Closure Pending Runtime Evidence**

## Review Scope

本次 Review 按 `SPEC-001-D Security Hardening` 的冻结规则和 Closure Requirement，对以下内容执行最终只读审计：

- 服务端是否以数据库中的当前用户状态作为最终授权身份；
- 旧 JWT claim、disabled user、角色降权与升权的处理；
- inspection list、detail、export、analysis 的资源权限与 Data Scope；
- 六身份 API 回归测试；
- 自动化测试、typecheck、lint 与 GitHub Actions 证据；
- Railway 或目标运行环境的必要运行时验证记录。

审计基于指定 Review / Handoff / Current State 文档、commit `f9b9f8f` 的相关源码和测试，以及 GitHub Actions Run `29491840228`。未修改源码、SPEC 或 migration。

## Evidence

### Source and authorization evidence

- `src/lib/permissions.ts` 的 `requireAuth()` 只从 session 读取 `user.id`，随后通过 `db.user.findUnique()` 查询当前 `id`、`role`、`organization_id` 和 `active`，并调用 `resolveAuthoritativeUser()` 生成授权身份。
- `src/lib/authoritative-user.ts` 对不存在或 `active = false` 的当前用户返回 `null`；返回的 role 与 organization 来自当前数据库记录，而非 JWT 中的旧 claim。
- 所有经 `requireRole()`、`requireDataScopeContext()`、`requireDataScopeResource()` 和 `requireOwnershipOrAdmin()` 的受保护授权均先经过上述 `requireAuth()`。
- inspection list 与 detail 均在业务查询前调用 `requireDataScopeResource('inspection_ledger')`；detail 已不再调用 `requireAuth()` + `requireOwnershipOrAdmin()` 的独立 owner/admin 旁路。
- export 调用 `requireDataScopeResource('export')`；analysis 调用 `requireDataScopeResource('param_analysis')`。冻结角色矩阵仍为：inspection / analysis 允许 `admin`、`quality_manager`、`inspector`，export 仅允许 `admin`、`quality_manager`。
- list、detail、export 和 analysis 都把解析后的 scope 转换为 Prisma `where` 或等价数据库查询条件；未发现读取全量 inspection 数据后再按身份过滤的实现。

### Test evidence

- `tests/security-hardening.test.ts` 包含 disabled old-session、stale JWT role 降权/升权、真实 Route Handler 调用、六身份矩阵以及 list/detail/analysis 查询条件断言。
- 六身份为 `admin`、`quality_manager`、`inspector`、`engineer`、`viewer`、disabled user；覆盖 list、detail、export、analysis。测试预期 engineer / viewer 对四个入口均为 403，disabled user 均为 401，inspector 对 export 为 403。
- `package.json` 的 `npm test` 明确包含 `tests/security-hardening.test.ts`。四个测试文件共声明 35 个测试，其中 security hardening 8 个。

### Verification evidence

| Verification | Decision | Evidence |
| --- | --- | --- |
| `npm test` | PASS（35/35） | 仓库共声明 35 个测试；Closure 记录 35/35，GitHub Actions 的 `Run automated tests` 步骤成功。 |
| `npm run typecheck` | PASS | GitHub Actions `TypeScript check` 步骤成功。 |
| `npm run lint` | PASS | GitHub Actions `Lint` 步骤成功。 |
| GitHub Actions Run `29491840228` | PASS | Run 状态 `completed / success`，commit 为 `f9b9f8fbf3e6a1585b122a956270acb417f889de`；verify job 及 test、typecheck、lint、build 等步骤均成功。 |

GitHub Actions 只使用临时 PostgreSQL。现有文档明确说明 CI 不连接 Railway 或生产数据库，因此该 Run 不能替代 SPEC 要求的目标运行环境验证。

## AUTH-001 Decision

**CLOSED（代码和自动化验证完成）**

已确认：

- Server-side authoritative user check 已生效；
- JWT 中旧 `role`、`active`、`organizationId` 不再作为最终授权依据；
- disabled user 的旧 session 在受保护 API 被拒绝；
- role downgrade / upgrade 有 helper 级测试和 Route Handler 级旧 session 测试证据，授权按数据库当前角色执行。

`AUTH-001` 的代码实现和自动化验证已经完成，因此本项标记为 `CLOSED`。目标运行环境的验证尚未完成，但这是 SPEC-001-D 整体 Closure 的待补证据，不表示 `AUTH-001` 代码失败。

## AUTH-002 Decision

**CLOSED（代码和自动化验证完成）**

已确认：

- inspection list、detail、export、analysis 使用冻结矩阵对应的统一资源权限入口；
- detail 不再通过 owner/admin 独立授权旁路；
- 六身份测试存在，并直接调用实际 Route Handler 验证返回码；
- Data Scope 在业务读取前解析，并进入各入口的 Prisma 查询条件或等价数据库条件。

`AUTH-002` 的代码实现和自动化验证已经完成，因此本项标记为 `CLOSED`。六身份及四个入口的目标运行环境验收记录仍待补充，但这只使 SPEC-001-D 整体 Closure Pending，不表示 `AUTH-002` 代码失败。

## Remaining Risks

1. **Closure pending evidence — Runtime Verification deferred.** 未发现 SPEC-001-D 修复版本部署至 Railway 或其他目标运行环境后，对 disabled old session、role downgrade / upgrade，以及六身份 list/detail/export/analysis 矩阵的验收记录。该状态表示运行时证据尚未取得，不表示代码或自动化验证失败。
2. 自动化 API 测试通过 module replacement 使用数据库 mock，可证明 Route Handler 的授权入口、状态码和查询条件构造，但不能单独证明生产 NextAuth session、Prisma/PostgreSQL 与部署环境组合行为。
3. `docs/review/SPEC-001-D-CLOSURE.md` 已记录 `AUTH-001 CLOSED` / `AUTH-002 CLOSED`，与代码实现和自动化验证事实一致；Closure Requirement 第 5 项的 Runtime Verification 仍作为 SPEC-001-D 整体 Closure 的待补证据。
4. 本结论仅审查 `AUTH-001` / `AUTH-002`。`FLOW-001`、`REPORT-001`、`DATA-001`、`ANALYSIS-001` 仍按原 Review Decision 阻塞 SPEC-001 整体 Closure。

## Final Decision

**Implementation Accepted**  
**Runtime Verification Deferred**  
**Closure Pending Runtime Evidence**

`AUTH-001` 与 `AUTH-002` 的代码修复、六身份自动化授权回归和指定 GitHub Actions 验证均满足要求，两项均为 `CLOSED`。SPEC-001-D 整体 Closure 仍 Pending，因为 Runtime Verification 尚未完成。

剩余阻塞项：

- 将 commit `f9b9f8f`（或包含同等修复的后续 commit）部署到 Railway 或批准的目标运行环境；
- 在该环境复核 disabled old session、role downgrade / upgrade；
- 在该环境复核六身份对 inspection list、detail、export、analysis 的冻结矩阵与 401 / 403 行为；
- 记录可追溯的部署版本、环境、时间、测试身份、请求入口、预期/实际状态码和结果。

完成并记录上述运行时验证后，可补齐 SPEC-001-D 的 Runtime Evidence，并重新评估其整体 Closure；无需重新打开已经基于代码和自动化验证关闭的 `AUTH-001`、`AUTH-002`。
