# SPEC-001-D 安全加固关闭记录（Security Hardening Closure）

- Closure 日期：2026-07-16
- 关联 SPEC：`SPEC-001-D Security Hardening`
- Closure 范围：`AUTH-001`、`AUTH-002`

## 背景

SPEC-001 Review Audit 确认，SPEC-001 MVP 的功能范围虽已完成，但整体 Closure 被阻塞问题阻断。SPEC-001-D 仅处理 `AUTH-001` 与 `AUTH-002`，目标是恢复服务端授权行为与 SPEC-001-A Data Scope Authorization 冻结规则的一致性，不改变既有角色—资源—动作矩阵。

## AUTH-001 修复内容

- 新增服务端权威用户状态查询，以 session 中的 `userId` 查询数据库中的当前用户状态。
- 受保护请求的授权不再把 JWT 中缓存的 `role`、`active`、`organizationId` 作为最终依据。
- 已停用用户的旧 session 会被拒绝；用户角色或组织变化后，后续请求按数据库中的最新状态授权。
- 权威用户校验集中在权限 helper 中复用，避免由单个 API 各自复制授权逻辑。

## AUTH-002 修复内容

- 检测详情 API 统一使用 `inspection_ledger` 资源权限入口，与检测列表的冻结授权规则保持一致。
- 移除详情 endpoint 独立的 owner/admin 授权旁路；owner 关系仅作为 Data Scope 计算因素，不替代资源权限。
- Data Scope 在服务端查询条件中执行，禁止先读取全量数据再过滤。
- 回归测试覆盖检测列表、详情、导出、分析的权限边界，以及 `admin`、`quality_manager`、`inspector`、`engineer`、`viewer`、已停用用户等身份。

## 修改文件列表

SPEC-001-D Implementation 与验证涉及以下文件：

- `package.json`
- `src/app/api/inspections/[id]/details/route.ts`
- `src/lib/authoritative-user.ts`
- `src/lib/permissions.ts`
- `tests/security-hardening.test.ts`

本 Closure 记录新增：

- `docs/review/SPEC-001-D-CLOSURE.md`

## 测试证据

| 验证项 | 结果 | 证据 |
| --- | --- | --- |
| `npm test` | PASS（35/35） | GitHub Actions Run `29491840228` 的 `Run automated tests` 步骤成功。 |
| `npm run typecheck` | PASS | 同一运行的 `TypeScript check` 步骤成功。 |
| `npm run lint` | PASS | 同一运行的 `Lint` 步骤成功。 |
| GitHub Actions | PASS | CI workflow 在 commit `f9b9f8f` 上完成并成功：[Run 29491840228](https://github.com/XiaoCaicccc/rock-drill-data-platform/actions/runs/29491840228)。 |

说明：本次编写 Closure 时，本地 Windows 沙箱执行 `npm.cmd test` 被用户目录 `lstat` 的 `EPERM` 环境权限限制阻塞，因此未将该次本地执行作为 PASS 证据；以上 PASS 结论来自已完成的 GitHub Actions Node 20 CI。

## Migration 影响

无需 Migration。

本 SPEC 未修改 Prisma Schema，未新增或修改 migration，也不影响既有生产数据结构。

## 范围外

以下范围保持不变，未纳入 SPEC-001-D：

- MFA；
- OAuth；
- SSO；
- 多租户；
- 组织模型重构；
- 自定义角色后台；
- 前端导航权限重构；
- 非检测资源的权限重设计。

## Closure 结论

- `AUTH-001 CLOSED`
- `AUTH-002 CLOSED`

本决定仅关闭 SPEC-001-D 范围。SPEC-001 整体 Closure 仍需等待其他阻塞问题按既定 Review 结论关闭。
