# SPEC-001-D 运行时验证（Runtime Verification）

- 验收日期：2026-07-16（Asia/Shanghai）
- 验收范围：SPEC-001-D Closure Requirement 第 5 项
- 目标环境：Railway production（目标服务未能识别）
- 总体结论：**BLOCKED**

## 状态定义

- **PASS**：已在本次验收中取得目标运行环境的可复核证据，且实际行为符合预期。
- **BLOCKED**：已尝试执行或确认，但缺少访问权限、环境定位信息或必要前置条件，无法得出结论。
- **NOT RUN**：因前置阻塞而未向目标应用执行该项生产测试；不得解释为通过或失败。

## 执行摘要

| 验收项 | 状态 | 本次证据与结论 |
| --- | --- | --- |
| 确认 Railway 当前部署包含 AUTH-001 修复 | **BLOCKED** | 本地仓库 HEAD 为 `f9b9f8f`，该提交包含 SPEC-001-D 修复并与 `origin/main` 一致；但 Railway 控制台要求登录，且本地没有 Railway CLI、项目关联或可核对的部署元数据，因此不能证明 Railway 当前运行的 commit 是 `f9b9f8f` 或包含同等修复的后续提交。 |
| 确认 Railway 当前部署包含 AUTH-002 修复 | **BLOCKED** | 与上项相同：只能确认本地/远端主分支代码状态，不能确认目标运行实例的部署版本。 |
| 生产登录流程 | **NOT RUN** | 未获得目标应用 URL及生产测试账号；未向目标应用提交登录请求。 |
| 已授权身份访问受保护 API | **NOT RUN** | 未获得目标应用 URL、有效测试会话和六身份测试账号；未请求 `/api/inspections`、`/api/inspections/{id}/details`、`/api/export` 或 `/api/analysis/param-comparison`。 |
| 未登录访问返回 401 | **NOT RUN** | 未能识别目标应用 URL，未向生产受保护 API 发出匿名请求。 |
| 已登录但无资源权限返回 403 | **NOT RUN** | 未获得 engineer/viewer 等受控测试账号或有效会话，未向生产 API 发出请求。 |
| 已停用用户的旧 session 被拒绝（AUTH-001） | **NOT RUN** | 缺少可安全停用并恢复的测试用户、其登录前会话，以及执行/复原用户状态变更的受控权限。 |
| 角色降权/升权后旧 session 按最新角色授权（AUTH-001） | **NOT RUN** | 缺少可安全变更并恢复角色的测试用户、旧会话和受控管理权限。 |
| 检测列表/详情权限一致（AUTH-002） | **NOT RUN** | 缺少六身份测试账号、可复核的检测 fixture/ID 和目标应用 URL。 |
| 导出/分析冻结矩阵与 Data Scope（AUTH-002） | **NOT RUN** | 缺少六身份测试账号、范围明确的生产测试数据和目标应用 URL。 |

## 已执行的只读检查

1. 核对本地 Git：`HEAD`、`origin/main` 均为 `f9b9f8f`；提交历史包含 `eb958c5`（实现）、`e3c7848`（安全验证）和 `f9b9f8f`（测试 lint 修复）。该结果只证明仓库版本，不证明 Railway 已部署该版本。
2. 核对仓库部署信息：未发现 Railway CLI 项目关联、Railway 配置目录、生产域名或可用于读取部署状态的本地命令。
3. 核对环境变量名称：本地 `.env` / `.env.local` 仅提供本地 `NEXTAUTH_URL`（`http://localhost:3000`），未发现目标运行环境 URL或运行时测试账号变量。未输出任何 secret 值。
4. 访问 Railway 控制台：`https://railway.app/dashboard` 重定向至 `https://railway.com/dashboard`，显示 Railway 登录对话框；当前浏览器不存在可用 Railway 登录会话，无法读取项目、环境、服务、域名、部署 commit 或日志。
5. 检索公开部署信息：未找到能够与本仓库可靠关联的公开 Railway 服务 URL。历史 `railway-homepage.png` 未包含 URL、部署 commit 或 SPEC-001-D 修复后的时间/行为证据，不能作为本次验收依据。

## 阻塞原因

本次无法访问目标 Railway 项目，也无法定位目标生产应用。缺少以下任一可用的部署访问路径：已登录且有只读项目权限的 Railway 会话、已关联的 Railway CLI/API 凭据，或可追溯到具体 Railway 部署的公开项目/服务信息。即使仅执行应用侧行为验证，当前也缺少生产 URL、六身份测试账号、可复核测试数据，以及 AUTH-001 状态变更场景所需的受控管理与复原能力。

因此，本报告不声明 Railway 当前版本包含 AUTH-001/AUTH-002，也不声明登录、受保护 API 或权限拒绝行为通过。

## 解除阻塞所需条件

1. Railway project/environment/service 的只读访问，或提供目标生产应用 URL 及可核验的部署记录（至少包含环境、部署时间、source commit SHA、部署状态）。
2. 确认部署 commit 为 `f9b9f8f`，或提供包含 `eb958c5`、`e3c7848`、`f9b9f8f` 同等修复的后续 commit 对照证据。
3. `admin`、`quality_manager`、`inspector`、`engineer`、`viewer`、已停用用户的专用验收账号；不得使用真实业务用户凭据。
4. 可复核且允许读取的检测测试数据/ID，以及明确的组织、owner、Data Scope 预期。
5. 用于 AUTH-001 的专用可变更测试用户、登录前旧会话，以及经授权的停用、角色降级/升级和测试后恢复流程。
6. 允许记录脱敏后的请求时间、身份、入口、预期/实际 HTTP 状态码、响应摘要及 Railway deployment 标识。

## 后续验收最小矩阵

解除阻塞后，应在同一已确认部署版本上至少执行：

- 登录：五个 active 角色成功登录；已停用用户登录或旧会话访问按设计被拒绝。
- 匿名：检测列表/详情、导出、分析的直接 API 请求返回 401。
- 资源拒绝：`engineer`/`viewer` 对检测列表/详情返回 403；没有导出权限的角色对导出返回 403。
- 允许访问：`admin`/`quality_manager` 按冻结矩阵访问；`inspector` 仅取得其 Data Scope 内的数据。
- AUTH-001：保持同一旧 session，分别执行停用、角色降级、角色升级，验证后续请求使用数据库最新状态，并恢复测试用户。
- AUTH-002：使用同一身份和同一数据条件对比列表/详情，确认详情不存在 owner/admin 授权旁路；同时复核导出/分析不扩大 Data Scope。

## Closure Requirement 第 5 项结论

**BLOCKED / 未满足。**

本次只读核查没有取得 Railway/目标运行环境的部署版本和实际运行行为证据。所有依赖目标应用的测试均为 **NOT RUN**，不存在生产验证 PASS 项；不得据此关闭 AUTH-001 或 AUTH-002。
