# SPEC-001-D 安全加固（Security Hardening）

## 状态

已批准进入 Implementation。

## 背景

SPEC-001 Review Audit 已完成。

当前项目状态为：SPEC-001 MVP 功能完成，但 Closure 被阻塞问题阻断。

本 SPEC 仅处理以下阻塞问题：

- AUTH-001
- AUTH-002

目标是恢复 SPEC-001-A Data Scope Authorization 冻结规则一致性。

## 1. 问题陈述

### AUTH-001：Session 权限状态滞后

当前认证会话中长期携带登录时的 `role`、`organization_id` 和 `active` 状态。

当管理员在数据库中停用用户或调整用户角色后，已有 JWT 会话可能继续使用旧权限访问受保护 API，直到会话自然失效或用户重新登录。

风险：

- 已停用用户可能继续访问业务数据；
- 降权后的用户可能继续以旧角色执行操作；
- 服务端授权结果与数据库中的权威用户状态不一致。

### AUTH-002：检测详情授权入口不一致

检测台账列表已接入 SPEC-001-A 冻结的 Data Scope / Resource Permission 入口。

但检测详情 API 使用独立 owner/admin 判断，未统一经过 `inspection_ledger` 资源授权。

风险：

- 不同检测读取入口权限行为不一致；
- `engineer` 等角色可能通过详情 endpoint 读取按冻结矩阵应返回 403 的检测明细；
- 列表/详情/导出/分析无法形成统一授权闭环。

## 2. 范围

本次实现范围：

- 设计并实现 session 权限有效性策略；
- 明确用户 `active` / `role` 变化后的服务端权限处理方式；
- 检查并统一检测数据所有读取入口的授权行为；
- 检测列表、详情、导出、分析必须符合 SPEC-001-A Data Scope Authorization 冻结规则；
- 补充覆盖六身份的授权回归测试。

涉及身份：

- admin
- quality_manager
- inspector
- engineer
- viewer
- 已停用用户

## 3. 范围外

本 SPEC 不包含：

- MFA；
- OAuth；
- SSO；
- 多租户；
- 组织模型重构；
- 自定义角色后台；
- 前端导航权限重构；
- 非检测资源的权限重设计。

## 4. 技术设计

### 冻结规则

本 SPEC 不修改 SPEC-001-A 已冻结角色 - 资源 - 动作矩阵。

如果发现当前代码与冻结矩阵冲突，必须修复代码以符合冻结规则，不得修改矩阵。

### Session 失效策略

本 SPEC 第一阶段采用服务端权威用户检查。

所有受保护 API 在执行权限判断前，必须基于 session 中 `userId` 查询当前 `user` 状态。

JWT 中的 `role`、`active`、`organizationId` 不作为最终授权依据。

`sessionVersion`、主动注销、集中式 session store 等机制暂不实现。

第一版优先满足：

- 已停用用户不得继续访问受保护 API；
- role 变更后服务端授权不得继续依赖旧 token role；
- 不引入复杂会话管理系统。

### 服务端授权策略

服务端授权必须以当前数据库中的用户状态为权威来源。

要求：

- 不信任客户端提交的 role、user_id、organization_id；
- 不把前端隐藏按钮作为授权边界；
- 401 / 403 行为保持一致；
- 权限判断必须发生在数据库业务查询前。

### Resource Permission 统一入口

检测数据读取入口必须统一经过冻结的资源权限入口。

要求：

- 列表使用 `inspection_ledger` 授权；
- 详情使用与列表一致的资源授权；
- 导出保持导出权限规则；
- 分析保持参数分析权限规则；
- 检测详情不允许使用 owner/admin 作为独立授权入口；
- 资源访问必须由 `requireDataScopeResource('inspection_ledger')` 决定；
- owner 关系只能作为 Data Scope 计算因素，不能替代 Resource Permission；
- Data Scope 必须进入 Prisma 查询条件或等价服务端查询条件；
- 禁止查询全量后再过滤。

## Implementation 约束

- 不允许通过删除现有权限函数绕过 Resource Permission。
- 优先复用现有 auth / permissions helper。
- 如果现有 helper 无法满足实时用户状态校验，应扩展 helper，而不是在单独 API 中复制授权逻辑。
- 所有检测 endpoint 必须共享同一授权入口。

## 5. 验收标准

### 六身份权限测试

必须覆盖：

- admin；
- quality_manager；
- inspector；
- engineer；
- viewer；
- 已停用用户。

验证要求：

- 未登录用户返回 401；
- 已登录但无权限返回 403；
- 已停用用户被拒绝访问所有受保护 API；
- role 被降权后，后续请求按最新角色授权；
- role 被升权后，后续请求按最新角色授权；
- 前端状态不得作为权限通过依据。
- 必须包含非前端路径测试：直接调用 API endpoint，绕过前端 UI，验证服务端仍拒绝非法访问。

### 检测接口测试

必须覆盖以下 inspection 相关入口：

- 列表；
- 详情；
- 导出；
- 分析。

验证要求：

- 列表与详情权限行为一致；
- engineer / viewer 对检测明细按冻结矩阵返回 403；
- inspector 只能访问其允许范围内的数据；
- admin / quality_manager 保持质量范围访问能力；
- 导出保持仅允许授权角色访问；
- 分析不因权限修复扩大 Data Scope。

### 回归要求

必须补充自动化或可复核验证：

- 停用用户旧会话失权；
- 角色变更后旧权限不再生效；
- 检测详情不再绕过 `inspection_ledger` 资源授权；
- 修复后重新执行 SPEC-001 Review 中 AUTH-001 / AUTH-002 对应检查。

## 6. Migration 影响

无需 Migration。

本 SPEC 不修改 Prisma Schema，不新增 migration，不修改历史 migration。

## 7. Closure 要求

AUTH-001 / AUTH-002 关闭条件：

1. 完成代码修改；
2. 完成六身份权限测试；
3. 完成检测列表/详情/导出/分析授权回归测试；
4. GitHub Actions 验证通过；
5. Railway 或目标运行环境完成必要运行时验证；
6. 重新执行 SPEC-001 Review 中 AUTH-001 / AUTH-002 检查；
7. 在 Review / Closure 文档中记录关闭证据。

AUTH-001 / AUTH-002 关闭后，SPEC-001 Closure 仍需等待其他阻塞问题关闭后再重新执行。
