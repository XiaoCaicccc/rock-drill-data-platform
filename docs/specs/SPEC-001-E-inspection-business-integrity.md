# SPEC-001-E 检测业务完整性（Inspection Business Integrity）

- 状态：设计完成 / 尚未实施
- 阻塞问题：`FLOW-001`
- 设计基线：2026-07-16
- 依赖：已冻结的 SPEC-001-A 授权与 Data Scope 规则
- 证据来源：`docs/review/SPEC-001-REMAINING-BLOCKERS-REVIEW.md`、`docs/CURRENT_STATE.md`、`docs/HANDOFF.md`、`prisma/schema.prisma`

## 1. 问题陈述

当前批量检测 API 可以持久化一条各个外键分别有效、但组合后的业务事实无效的 `inspection_record`。系统没有证明提交的已发布零件版本确实装配在目标设备上，没有证明参数项属于该装配零件的类别，也没有证明同一检测记录内测量组合只出现一次。关系检查还发生在写入 Transaction 之外，存在 TOCTOU（检查时与使用时不一致）窗口。

同时，`inspector` 已获准执行检测工作，但读取设备与装配数据时仍受 legacy equipment owner scope 限制。因此，inspector 无法稳定完成“选择设备及其已装配零件版本—选择有效参数—保存测量结果”的既定主流程。对于 `created_by = null` 的历史或种子设备，这种不一致尤其明显。

`FLOW-001` 仍然阻塞 Closure，因为系统既可能拒绝核心角色的合法工作流，也可能接受结构有效但业务语义错误的正式质量记录。

## 2. 当前架构分析

### 2.1 数据链路

当前 schema 已包含校验目标链路所需的全部关系：

```text
equipment
  -> equipment_part_installation
  -> part_revision (released)
  -> part
  -> part_category
  -> parameter_template
  -> parameter_item
  -> inspection_data_item
  -> inspection_record (equipment, inspection date, session user)
```

- `equipment_part_installation` 将设备实例关联到特定 `part_revision`，并记录 `installed_at`、`removed_at` 和 `status`。
- `part_revision.part_id` 将受控版本关联到稳定的 `part`；`part.category_id` 提供零件类别。
- `parameter_template.category_id` 具有唯一约束，每个 `parameter_item` 从属于一个模板。
- `inspection_record` 可选关联设备与用户。
- `inspection_data_item` 分别关联 `part`、可选的 `part_revision` 与 `parameter_item`。

这些独立外键只能保证对象存在，不能保证 `inspection_data_item.part_id = part_revision.part_id`，不能保证该版本装配在检测记录对应的设备上，也不能保证参数模板类别与零件类别一致。当前也没有约束同一检测记录内 `(part_revision_id, param_item_id)` 测量组合的唯一性。

### 2.2 当前 batch 写入行为

Review 已确认，batch Route Handler 分别加载设备、零件版本和参数项，校验对象存在且零件版本为 released，随后在 Serializable Transaction 中创建检测记录与明细。关系读取与校验位于 Transaction 之外。Serializable 隔离级别无法自动执行未被查询和检查的业务不变量。

客户端当前提交多个被默认视为相互兼容的标识。写入模型还同时保存 `part_id` 与 `part_revision_id`，尽管权威 `part_id` 可以从零件版本派生。

### 2.3 当前访问行为

SPEC-001-A 的角色—资源—动作矩阵和“查询前授权”规则已经冻结。当前检测能力允许 `inspector` 参与，但设备列表对普通角色应用 legacy creator scope，装配读取则执行 owner/admin 校验。该读取策略与已经授权的检测动作不一致，导致 UI 无法稳定取得 batch API 所需的权威选择项。

本 SPEC 不重新设计通用授权矩阵，只要求在既有检测能力内提供完成检测所需的最小设备与装配只读数据；设备编辑和装配变更权限保持不变。

## 3. 根因分析

`FLOW-001` 包含四个相互关联的根因：

1. **只校验对象，不校验链路。** API 只确认 ID 存在，没有确认这些 ID 组成一条合法的设备到测量项链路。
2. **校验与写入不是同一原子操作。** 装配状态可能在校验后、创建记录前发生变化。
3. **信任客户端提交的冗余关系。** 服务端没有始终从权威数据派生 `part_id`、`user_id` 和合格判定。
4. **业务能力与读取范围不匹配。** 允许创建检测记录的角色不能稳定发现构造合法请求所需的设备、装配和类别匹配参数项。

主要关系并未缺失于 schema。核心缺陷是 service 边界没有定义并原子执行这些关系组成的业务不变量。

## 4. 范围

- 冻结并执行“设备—有效装配—已发布版本—零件类别—参数模板—参数项—检测数据项”的合法链路。
- 将 batch 检测校验与持久化收口到同一个 service Transaction。
- 冻结检测时点有效装配规则：`equipment_id` 与检测记录一致，且 `installed_at <= inspection_date`，并满足 `removed_at IS NULL` 或 `removed_at > inspection_date`。该时间谓词是检测写入和 inspection-entry 读取的权威规则，冗余 `status` 文本不得覆盖该规则。拒绝未来检测时间；受控补录可以使用该时间谓词，但批量历史导入不在范围内。
- 要求所有新写入的检测数据项必须关联非空且 released 的 `part_revision_id`。
- 从 `part_revision.part_id` 派生 `part_id`；从权威 session 派生 `user_id` 和检测员身份；按现有参数规则计算判定字段。
- 要求 `parameter_item.template.category_id = part_revision.part.category_id`。
- 拒绝同一检测记录内重复的 `(part_revision_id, param_item_id)`；不同检测记录可以再次测量同一组合。
- 在不改变管理权限的前提下，使检测录入所需的设备、有效装配与类别匹配参数项只读能力和既有 Inspection 授权、Data Scope 保持一致。
- 增加确定性错误 contract、审计行为、直接 API 绕过测试和并发装配变化回归。
- 保留 `part_revision_id = null` 的历史检测数据；更严格的规则仅适用于新的 batch 写入。

## 5. 范围外

- 重新设计 SPEC-001-A 角色矩阵、角色名称或组织模型。
- 新建设备、零件、模板或装配管理功能。
- 修改零件版本发布生命周期规则。
- 清理、自动重新关联或删除历史检测数据。
- 批量历史检测导入，以及跨不同检测记录的测量幂等性。
- 模板版本管理或客户模板管理；该事项属于后续质量模板 SPEC。
- Dashboard 指标、参数分析公式、报告发布一致性或其他 Review blocker。
- BOM、ECN/ECR、NCR/CAPA、通用工作流或更大范围 PLM 扩展。

## 6. 技术设计

### 6.1 冻结的业务不变量

对于每个新建的 `inspection_data_item`，提交时必须同时满足：

1. 父级 `inspection_record.equipment_id` 指向调用者在冻结 Inspection Data Scope 内可用的设备。
2. 提交的 `part_revision_id` 存在且 `lifecycle_state = released`。
3. 在 `inspection_date` 时点，存在连接该设备与该版本的有效 `equipment_part_installation`，权威谓词为 `installed_at <= inspection_date AND (removed_at IS NULL OR removed_at > inspection_date)`。
4. 存储的 `part_id` 由 `part_revision.part_id` 派生并与其相等。
5. 所选 `parameter_item` 所属模板的 `category_id` 与 `part.category_id` 相等。
6. 判定字段使用第 6.4 节定义的既有规则计算；本 SPEC 不创造新的合格判定业务规则。
7. 每条检测记录中，同一 `(part_revision_id, param_item_id)` 最多出现一次。
8. 检测记录的 `user_id` 和检测员身份来自已认证且 active 的当前用户，不来自请求身份字段。

任一数据项失败都必须使整个 batch 失败。失败后不得残留检测头、检测明细或成功审计记录。

### 6.2 共用锁协议与 Transaction 边界

新增聚焦检测业务完整性的 service。Route Handler 负责认证、请求结构校验和既有 Inspection 资源授权，然后调用该 service。

batch 检测、设备变更和装配变更必须使用同一套 PostgreSQL 锁协议。协议冻结如下：

1. 针对某设备的每次 batch 写入、设备更新/删除、装配新增/拆卸/替换，都必须在读取可变设备或装配状态之前启动数据库 Transaction。
2. Transaction 首先对目标设备执行参数化查询 `SELECT id FROM "equipment" WHERE id = $1 FOR UPDATE`。若设备不存在，返回符合 Data Scope 的 not-found 结果。该设备行锁是所有相关写操作的共同串行化点。
3. 如果未来一次操作可能涉及多台设备，必须按 `id` 升序锁定设备。当前 batch contract 只允许一台设备。
4. 获取设备锁后，再通过参数化查询 `SELECT ... FROM "equipment_part_installation" ... ORDER BY id FOR UPDATE` 读取操作所需的装配行。装配行只能在父设备锁之后、按稳定的 `id` 顺序加锁。
5. 装配 POST/PUT 和设备 PUT/DELETE 必须重构为相同顺序。任何 endpoint 都不得在取得父设备锁前改变装配有效性。
6. batch Transaction 在取得锁之后重新计算权威时间谓词。锁保持到检测记录、明细和成功审计写入完成并 commit。
7. Transaction 之前的关系读取只能用于结构校验或 UI，不得作为完整性证明。

共用设备行锁可以阻止装配变更在 batch 校验与 commit 之间提交。装配行上的 `FOR UPDATE` 进一步阻止校验中的装配行被并发修改。新增或替换装配也无法绕过，因为其 Transaction 必须先取得同一设备行锁。

在已加锁的 PostgreSQL Transaction 内，service 按以下顺序执行：

1. 校验并规范化检测时间和测量列表。
2. 在任何数据库写入前拒绝重复测量组合。
3. 按冻结顺序取得设备锁和装配锁。
4. 在同一 Transaction 内读取 batch 所需的 released 版本、零件/类别、模板和参数项。
5. 将权威关系集合与每个提交组合进行比对，拒绝缺失或不兼容关系。
6. 使用 session 派生身份创建检测记录头。
7. 使用派生 `part_id` 和既有规则的判定结果创建明细。
8. 在同一 Transaction 内写入成功审计。

Transaction 使用 Serializable 隔离级别。Prisma 普通 model query 不提供行锁，因此共用锁查询必须在 Prisma interactive Transaction 内通过带绑定参数的 `$queryRaw` 执行。禁止字符串拼接、`$queryRawUnsafe`、动态标识符输入，以及客户端提供的身份或 Data Scope 查询片段。

最多执行三次完整 Transaction 尝试。仅对 PostgreSQL serialization failure `40001`、deadlock `40P01`、对应的 Prisma Transaction conflict（如 `P2034`），以及并发编号分配导致的 `record_no` 唯一冲突进行重试。第二次尝试前随机等待 25–50 ms，第三次尝试前随机等待 75–150 ms；退避期间不得保留 Transaction 或数据库锁。认证、授权、请求校验、not-found、生命周期、类别、装配、重复项及其他 domain failure 不重试。第三次可重试失败后返回 `409 CONCURRENT_MODIFICATION`，不得返回部分成功。每次重试必须重新生成 `record_no`，重新执行全部权威读取和加锁，并且只在最终 commit 的尝试中产生成功审计。

### 6.3 重复测量策略

一条检测记录内测量项的业务标识为 `(part_revision_id, param_item_id)`。service 在创建记录前拒绝重复组合并返回 `409 Conflict`。后续其他检测记录再次测量相同组合是合法的新检测事件。

数据库约束属于可选加固，不是 Closure 基线依赖。若后续单独批准，可在完成历史冲突分析后增加 `(record_id, part_revision_id, param_item_id)` 唯一约束，以镜像同一业务不变量。

### 6.4 既有合格判定规则

本 SPEC 将判定计算收口到完整性 service，但不改变既有业务语义：

- 对于 `is_qualified`，当 `value_number`、`standard_min` 或 `standard_max` 为 null 时存储 `null`；否则存储 `standard_min <= value_number <= standard_max` 的结果。
- 对于 `is_optimal`，当 `value_number`、`optimal_min` 或 `optimal_max` 为 null 时存储 `null`；否则存储 `optimal_min <= value_number <= optimal_max` 的结果。
- `value_text` 不产生数值判定；没有可判定数值或上下限时，判定字段保持 null。
- 当所有数据项的 `is_qualified = null` 时，`overall_result` 保持“待检”；所有非 null 结果均为 true 时为“合格”；任一非 null 结果为 false 时为“不合格”。

Implementation 应提取或复用现有规则，确保移动到 service 后不改变边界包含关系、null 行为、文本行为和 overall result 语义。未来若要改变这些规则，必须建立独立并获批的设计。

### 6.5 inspection_date timestamp contract

设备发现、有效装配发现和 batch 写入必须共享同一个严格 timestamp parser；Route Handler 不得各自调用宽松的 `new Date(input)` 或维护不同的正则、时区或 future 判断。contract 冻结如下：

1. `inspection_date` 必须是 RFC 3339 date-time 字符串，必须包含大写 `T`、完整的时分秒，以及 `Z` 或显式数字 offset（`±HH:MM`）。允许 1–3 位小数秒；不接受日期-only、无 offset 的本地时间、时区名称、空白、闰秒、无效日历日期或超出 RFC 3339 offset 范围的输入。
2. parser 将合法输入转换为唯一 UTC instant，并输出规范化的 UTC ISO 字符串和 `Date`/数据库时间值。所有时间有效性谓词、持久化和比较均使用该 UTC instant；不得使用服务器本地时区、浏览器本地时区或 PostgreSQL session timezone 重新解释输入。
3. 不同 offset 表示的同一 instant 必须产生完全相同的发现、有效装配和 batch 校验结果。响应可以统一序列化为 UTC `Z` 形式，不保留客户端原始 offset 文本作为业务事实。
4. future comparison 使用 parser 取得的 UTC instant 与服务端在请求校验时捕获的一次权威 UTC `now` 比较。`inspection_date <= now` 合法，`inspection_date > now` 返回 `400 INVALID_REQUEST`；不设置隐式时钟容差。测试必须注入或冻结 `now`，避免依赖墙钟竞态。
5. 同一次请求的 future 判断只读取一次 `now`。inspection-entry 的三个专用读取 Route 和 batch Route 必须复用同一 parser/helper、同一精度和同一错误 code，不得由数据库隐式解析原始字符串。
6. inspection-entry 读取不预留选择结果：最终 batch 必须再次解析时间，并在已加锁 Transaction 内用同一个 UTC instant 重新校验装配有效性。

### 6.6 batch 请求与响应 contract

`POST /api/inspections/batch` 只接受以下严格 JSON 对象：

```ts
type BatchInspectionRequest = {
  record: {
    equipment_id: string
    inspection_date: string // 第 6.5 节定义的 RFC 3339 timestamp，不得晚于服务器权威 UTC now
    batch_no?: string | null
    remark?: string | null
  }
  items: Array<{
    part_revision_id: string // UUID
    param_item_id: string
    value_number: number | null // 非 null 时必须为有限数值
    value_text: string | null
  }>
}
```

contract 规则：

- `record`、`equipment_id`、`inspection_date` 和 `items` 必填；标识符不得为空或仅含空白。
- `items` 数量必须为 1–500。空数组返回 `400 EMPTY_BATCH`；超过 500 条返回 `400 BATCH_TOO_LARGE`。服务端必须拒绝，不得截断。
- 每个数据项必须显式提供两个 value 字段；为保持既有待检/文本行为，两者都可以为 null。非 null 的 `value_number` 必须为有限数值。可以 trim 可选的检测记录文本，但不得重新解释测量值。
- 拒绝未知字段。以下身份或派生字段在任意层级均明确禁止：`user_id`、`created_by`、`organization_id`、`inspector`、`record_no`、`overall_result`、`part_id`、`is_qualified`、`is_optimal`。出现这些字段时返回 `400 FORBIDDEN_FIELD`，不得静默接受或信任。
- 重复项按标识符规范化后的 `(part_revision_id, param_item_id)` 精确判断。同一请求内出现重复组合时返回 `409 DUPLICATE_MEASUREMENT`，不得写入检测头、明细或成功审计。不同检测记录可以使用相同组合。
- 成功时返回 `201`，包含已创建的检测记录和明细。响应中的身份与派生字段必须是 commit 后的服务端值。
- 错误响应保留现有可读 `error` 字符串，并增加稳定 `code`：`{ "error": string, "code": BatchInspectionErrorCode }`。

稳定错误码冻结如下：

| HTTP | Code | 触发条件 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | JSON 结构、时间、标识符无效，或数值不是有限值 |
| 400 | `FORBIDDEN_FIELD` | 客户端提交身份字段、服务端派生字段或未知字段 |
| 400 | `EMPTY_BATCH` | `items` 为空 |
| 400 | `BATCH_TOO_LARGE` | `items` 超过 500 条 |
| 401 | `UNAUTHENTICATED` | 没有有效权威 session |
| 403 | `FORBIDDEN` | 角色或资源动作被拒绝 |
| 404 | `RESOURCE_NOT_FOUND` | Data Scope 内设备、零件版本或参数对象不可用，且不得泄露越界对象是否存在 |
| 409 | `REVISION_NOT_RELEASED` | Data Scope 内版本存在但未发布 |
| 409 | `INSTALLATION_NOT_ELIGIBLE` | 在 `inspection_date` 时点，该版本未有效装配在目标设备上 |
| 409 | `PARAMETER_CATEGORY_MISMATCH` | 参数模板类别与零件版本所属零件类别不一致 |
| 409 | `DUPLICATE_MEASUREMENT` | 同一 batch 内测量组合重复 |
| 409 | `CONCURRENT_MODIFICATION` | 三次可重试 Transaction 尝试全部失败 |
| 500 | `INTERNAL_ERROR` | 未分类服务端错误；不得暴露内部细节 |

### 6.7 错误与信息泄露行为

响应应提供稳定的机器可读错误码，但不得返回其他租户或用户的资源细节。被拒绝的请求不得写入成功审计。安全相关拒绝可以记录 telemetry，但不得包含密码、Token、签名 URL 或越界 payload 数据。

## 7. 所需 Service/API 变更

### Service/Policy 层

- 新增 inspection integrity service，统一负责 Transaction、关系查询、派生字段、既有合格判定、重复策略和确定性 domain error。
- 新增或扩展 inspection-entry 读取 policy/helper，使用既有 Inspection 授权上下文。
- 复杂关系和 Transaction 逻辑不得保留在 Route Handler 内。

### batch 检测 API

- 重构 `POST /api/inspections/batch`：认证、结构校验、解析授权后委托 service。
- 执行第 6.5、6.6 节冻结的 timestamp、严格请求、禁止字段、batch 大小、重复项、响应和错误码 contract。
- 客户端提交 `user_id`、`created_by`、organization、inspector identity、`record_no`、`overall_result`、`part_id` 或判定字段时返回 `400 FORBIDDEN_FIELD`。
- 每个新测量项必须包含零件版本 ID 与参数项 ID。
- 保持全有或全无的原子行为。

### inspection-entry 专用读取 API

- 新增窄范围的 inspection-entry 读取面，不放宽通用设备或参数模板 GET：
  - `GET /api/inspections/entry/equipment?inspection_date=<RFC3339>`
  - `GET /api/inspections/entry/equipment/[id]/parts?inspection_date=<RFC3339>`
  - `GET /api/inspections/entry/parameters?category_id=<id>`
- 三个 Route 都从属于既有 `inspection_ledger` resource。每个数据库查询前都必须调用 `requireDataScopeResource('inspection_ledger')`，不得使用仅认证、template creator ownership 或 Route 内第二套角色列表替代该入口。
- 三个 Route 的六身份矩阵冻结如下：

| 身份 | equipment discovery | parts discovery | parameter discovery |
| --- | --- | --- | --- |
| `admin` | `200`，`all` scope | `200`，`all` scope | `200`，`all` scope |
| `quality_manager` | `200`，`quality` scope | `200`，`quality` scope | `200`，`quality` scope |
| `inspector` | `200`，`quality` scope | `200`，`quality` scope | `200`，`quality` scope |
| `engineer` | `403` | `403` | `403` |
| `viewer` | `403` | `403` | `403` |
| anonymous | `401` | `401` | `401` |

- 解析出的 `all` 或 `quality` scope 必须进入 Prisma/raw SQL predicate。当前 quality scope 是检测所需的质量域，不是 equipment、template 或 parameter creator ownership；因此，`quality_manager` 与 `inspector` 可通过专用 Route 读取符合条件的非本人或 `created_by = null` 设备、模板和参数项，但不得获得其管理能力。
- equipment 与 parts Route 都要求提供与最终 batch 相同的、第 6.5 节定义的有效且非未来 `inspection_date`，防止发现与写入谓词漂移。
- 设备列表仅返回 `id`、`machine_no`、`model`、`status`，且设备在请求检测时点至少有一个有效装配。不得返回 creator、remark、inspection count、管理元数据或变更能力。
- 零件列表仅返回有效装配/版本选择字段：installation ID、`part_revision_id`、`part_id`、零件 code/name、类别 ID/code/name、revision number、`installed_at`、`removed_at`。数据库谓词必须与 batch 写入使用相同的检测时点规则。
- parameter Route 要求非空 `category_id`，只查询 `parameter_template.category_id = category_id` 的模板及其参数项。Data Scope、类别条件和最小字段选择必须在数据库查询中执行；不存在或 scope 外类别统一返回 `200` 空数组，不得泄露其存在性。响应中的每个参数项只返回 `id`、`param_code`、`param_name`、`unit`、`data_type`、`standard_min`、`standard_max`、`optimal_min`、`optimal_max`、`sort_order`；不得返回 template creator、remark、管理状态、审计字段或写入能力。
- 这些 Route 只授权检测录入发现能力，不授权通用 `GET /api/equipment`、`GET /api/parameter-templates`、设备详情/管理读取、模板管理、设备增删改或装配增删改/历史读取。
- 通用 equipment 与 parameter-template Route 保持现有权限行为，除非后续独立 SPEC 明确变更。检测 UI 必须仅使用三个专用 Route 完成设备、版本和参数选择，不得回退到通用 Route。
- 在当前冻结的第一阶段 `quality` scope 下，equipment 没有 organization 字段，Inspection 访问也不是 creator-owned。专用数据库谓词因此固定为：调用者已获得 `inspection_ledger` 授权、设备至少存在一个检测时点有效装配，并只选择最小字段。不得附加 `created_by = session.user.id`，也不得凭空增加 schema 不支持的 organization 过滤。未来组织隔离需要独立获批的数据模型与权限变更。
- 前端过滤不是安全边界，三个专用 Route 均不得先读取全部设备、装配、模板或参数项再过滤。

上述 batch contract 和精确响应类型必须与 inspection-entry UI 共用。本设计不授权其他新 Route。

## 8. 数据模型影响

基线 Implementation 复用现有 model 和关系。关闭对象链路、授权与 Transaction 缺陷不需要 schema 变更。

兼容规则：

- `inspection_data_item.part_revision_id` 继续允许 null，以兼容历史未知版本记录；batch service 对新写入要求非 null。
- `inspection_record.equipment_id` 继续允许 null，以兼容历史数据；当前设备型 batch 工作流对新写入要求非 null。
- `inspection_data_item.part_id` 继续保留，以兼容既有查询；新写入必须从零件版本派生。
- 既有表名、mapping、已发布版本、正式记录与审计历史均不修改。

Implementation 前应执行只读完整性审计并报告，不得修改数据：

- 重复 `(record_id, part_revision_id, param_item_id)`；
- `part_id` 与版本所属零件不一致；
- 零件类别与参数模板类别不一致；
- 根据当前 schema 可用数据判断，零件版本在检测记录对应设备上不满足检测时点有效性。

当前 schema 没有在测量项上保存不可变 installation link 或 installation snapshot，因此历史有效性仍需从可变装配历史推断。本 SPEC 防止新的错误写入，但不宣称所有历史链路已经独立不可变。

## 9. 权限影响

SPEC-001-A 矩阵保持冻结。本设计不改变角色、不改变报告/导出/Dashboard 权限，也不改变设备或装配变更权限。

唯一权限影响是新增从属于既有 `inspection_ledger` resource 的设备、有效装配和类别匹配参数专用读取能力：

| 身份 | inspection-entry 设备/装配/参数专用读取 | 通用设备/模板读取与管理 | batch 检测写入 |
| --- | --- | --- | --- |
| `admin` | 允许，`all` scope | 不变 | 允许 |
| `quality_manager` | 允许，`quality` scope | 不变 | 允许 |
| `inspector` | 允许，`quality` scope；不应用 equipment/template creator ownership | 不变；不新增管理权限 | 允许 |
| `engineer` | `403` | 不变 | `403` |
| `viewer` | `403` | 不变 | `403` |
| anonymous | `401` | 需要认证的入口返回 `401` | `401` |

Implementation 必须通过 `requireDataScopeResource('inspection_ledger')` 派生允许角色与动作，不得在 Route 内维护第二套角色列表。已授权但没有符合条件的设备、装配或类别参数时，专用读取返回 `200` 和空结果；角色/动作拒绝仍返回 `403`。batch 写入必须使用与专用读取相同的 resource decision 和 scope，确保直接 POST 不能超出 UI 可见范围。

## 10. Migration 影响

### 基线建议

不需要 Migration。现有关系足以在同一 Transaction 内进行 service 校验，保留历史 nullable 字段可以避免不安全的回填假设。

### 条件性加固方案

只有完成只读生产数据审计并取得明确业务批准后，才可以通过新的 Prisma Migration 增加 `(record_id, part_revision_id, param_item_id)` 唯一约束。前置条件：

1. 确认同一检测记录内重复组合绝不是有效复测。
2. 识别并明确处置全部历史冲突；不得静默删除或覆盖正式质量数据。
3. 验证 PostgreSQL 对 nullable `part_revision_id` 的行为，并记录保留的兼容语义。
4. 只能新增 Migration；不得修改既有 Migration，也不得在生产环境使用 `prisma db push`。

如果要给检测数据项增加不可变 installation identity 或 snapshot，需要独立设计、历史回填策略和 Migration；关闭 `FLOW-001` 不依赖该方案。

## 11. 测试策略

### 纯函数与 Service 测试

- shared timestamp parser 覆盖：UTC `Z`、正负显式 offset、1–3 位小数秒、不同 offset 的等价 instant，以及规范化后的 UTC 输出。
- shared timestamp parser 拒绝：date-only、无 offset、本地时间、时区名称、闰秒、无效日期、非法 offset、空白和超过三位的小数秒。
- 注入固定 UTC `now` 验证 `inspection_date = now` 合法、晚 1 ms 拒绝、同一请求只取一次 `now`，且 equipment/parts discovery 与 batch 映射到同一 `INVALID_REQUEST`。
- 重复组合检测，包括不相邻的相同组合。
- 严格 request schema、禁止字段、空 batch、500 条 batch 和 501 条拒绝。
- 证明既有数值边界、null、文本和 overall result 判定行为不变的回归测试。
- `part_id`、session user identity 和检测员显示值的派生。
- domain error 到 HTTP status 与稳定 error code 的映射。

### PostgreSQL API 集成测试

- 合法 inspector 通过三个专用 inspection-entry Route 完成设备列表、有效装配读取、类别匹配参数选择、batch 创建和结果读取；参数模板由其他用户创建或 `created_by = null` 时仍可完成该流程。
- parameter discovery 只返回冻结的最小字段，只返回请求 category 的参数；scope 外或不存在 category 返回 `200` 空数组，且通用 parameter-template 读取/管理权限不变。
- 时间边界：`installed_at = inspection_date` 时有效；`removed_at = inspection_date` 时无效；`removed_at` 严格晚于检测时间时有效；未来检测时间被拒绝。使用至少一组 `Z` 与正/负 offset 表示的等价 instant 验证 discovery 与 batch 结果一致，并在非 UTC Node/PostgreSQL session timezone 下回归。
- 拒绝不存在对象、非 released 版本、未装配版本、装配在其他设备的版本、检测时点无效装配、未来装配、未来检测时间、错误类别参数和重复组合。
- 每个被拒绝的多项 batch 都不得留下检测记录、明细或成功审计。
- 客户端提交的身份、`part_id` 和判定字段不能伪造存储值。
- 合法多零件 batch 中，每个明细都关联到正确的已装配 released 版本。
- 对装配拆卸、替换、设备更新/删除与 batch 进行受控并发测试；断言所有 writer 先取得父设备锁、装配变更不能越过已加锁 batch，batch 等待后会重新校验。
- 强制触发 `40001`、`40P01`/Prisma `P2034` 和 record number 冲突；断言完整重试、最多三次、退避期间无锁、最多一个已 commit 记录/审计，重试耗尽后返回 `409 CONCURRENT_MODIFICATION`。
- 验证不同检测记录可以再次测量同一版本/参数组合。

### 授权回归

对 `admin`、`quality_manager`、`inspector`、`engineer`、`viewer` 和 anonymous 验证三个专用 inspection-entry 发现 Route 与 batch 写入矩阵。包含其他 creator 和 `created_by = null` 的设备及参数模板。验证数据库查询前完成授权、Data Scope 和 category/time 条件进入数据库谓词，并且专用访问不改变或绕过通用设备、装配与模板读取/管理 Route 的权限；增加绕过 UI 直接调用 parameter discovery 的 401/403、最小字段和越界类别测试。

### Implementation 阶段 Schema 与交付验证

- `npx prisma validate` / 仓库命令 `npm run db:validate`
- `npx prisma generate` / `npm run db:generate`
- 针对 service 和 API 的临时 PostgreSQL 测试
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Node 20 GitHub Actions PostgreSQL/Migration gate

只有实际具备冻结的 Node `>=20.19.0 <21` 环境和 PostgreSQL 前置条件时，才可以把本地结果记录为 PASS。

## 12. 验收标准

1. 已授权 inspector 只能通过三个专用 inspection-entry Route 发现有效设备装配和类别匹配参数，并在不拥有设备或参数模板记录的情况下完成主流程。
2. 当 `created_by = null` 的设备或参数模板属于调用者冻结的 quality scope 时，不会阻断专用 inspector 主流程；通用设备、模板可见性与全部管理权限保持不变。
3. 三个专用读取 Route 均通过 `inspection_ledger` 授权，只暴露各自冻结的最小字段，在数据库查询中应用 Data Scope 以及适用的时间/category 条件；admin、quality_manager、inspector 返回 scope 内结果，engineer/viewer 返回 `403`，anonymous 返回 `401`。
4. equipment/parts discovery 与 batch 只接受第 6.5 节定义的带 `Z` 或显式 offset 的 RFC 3339 timestamp，规范化为同一 UTC instant，复用同一 parser 和单次捕获的 UTC `now`；无 offset、无效或未来时间返回 `400 INVALID_REQUEST`，等价 offset 在不同时区环境产生相同结果。
5. 每个新测量项都遵循设备—检测时点有效装配—released 版本—零件/类别—模板—参数链路，谓词为 `installed_at <= inspection_date AND (removed_at IS NULL OR removed_at > inspection_date)`。
6. 直接 API 使用未装配、检测时点无效、属于其他设备或非 released 版本时，返回冻结的 4xx code，且不产生部分数据。
7. 直接 API 使用其他类别参数时返回 `409 PARAMETER_CATEGORY_MISMATCH`，且不产生部分数据。
8. 空 batch 返回 `400 EMPTY_BATCH`；合法 500 条 batch 可以接受；501 条返回 `400 BATCH_TOO_LARGE`，不得截断或写入。
9. 同一 batch 内重复 `(part_revision_id, param_item_id)` 时返回 `409 DUPLICATE_MEASUREMENT`，不得产生检测头、明细或成功审计；后续独立检测记录可以重复该组合。
10. 任何禁止或未知字段都返回 `400 FORBIDDEN_FIELD`。`part_id`、`user_id`、检测员身份、`record_no`、overall result 与判定字段均由服务端派生，客户端无法伪造。
11. qualification 与 overall result 回归测试证明 SPEC 实施前的数值边界、null 和文本行为保持不变。
12. batch、设备变更与装配变更先通过 PostgreSQL `FOR UPDATE` 获取同一设备行，再按稳定顺序锁定装配行。所有关系读取、校验、记录/明细创建和成功审计均位于该已加锁 Transaction 内。
13. 受控并发拆卸/替换不能产生无效 commit 记录。可重试冲突最多执行三次完整尝试；重试耗尽返回 `409 CONCURRENT_MODIFICATION`，不得产生部分数据或重复审计。
14. 六身份授权回归符合冻结的 SPEC-001-A 规则；不得扩大通用设备、模板、管理、导出、报告、Dashboard 或其他无关权限。
15. 现有 revision/equipment link 为 null 的历史记录保持可读且不修改。
16. 针对性测试、Prisma validate/generate、typecheck、lint、build 与 PostgreSQL CI 全部通过并记录证据后，才能声明 Implementation 完成。
17. 不修改任何既有 Migration；任何可选约束必须单独批准，以新 Migration 交付，并先完成历史冲突分析。

## 13. Closure 要求

只有具备以下全部证据，才能把 `FLOW-001` 标记为 closed：

1. Implementation 已按本 SPEC 冻结链路和 SPEC-001-A 授权规则完成 Review。
2. PostgreSQL 自动化测试证明合法 inspector 主流程、全部直接 API 拒绝、原子回滚、重复处理和并发装配变化均符合要求。
3. 记录全部 Implementation 验证命令和 CI 结果，明确区分 failure、skipped、环境限制和 PASS。
4. 记录只读历史完整性审计结果及可选唯一约束决策。历史异常可以转入明确批准的修复方案，但不得静默修改。
5. 目标环境 Runtime Acceptance 证明 inspector 可以处理非本人或 null creator 的符合条件设备与参数模板，且没有扩大通用读取或管理权限。
6. 聚焦 SPEC-001-E 的 Review 记录 `PASS`，随后重新执行 Remaining Blockers Review 和 SPEC-001 整体 Closure。创建设计文档或完成 Implementation 本身都不能直接关闭 `FLOW-001`。

## 推荐 Implementation 顺序

1. 冻结 request/error contract，并先增加失败的完整性、授权与并发测试。
2. 新增 inspection integrity service 和 Transaction 内权威关系查询。
3. 重构 batch Route Handler，委托 service 并移除对客户端冗余字段的信任。
4. 新增专用 inspection-entry 设备、装配与参数读取，不改变通用 equipment 或 parameter-template 可见性。
5. 将共用设备/装配锁协议应用到设备与装配变更 Route。
6. 仅按 API contract 需要更新 inspection-entry UI/type。
7. 执行只读历史审计，决定是否需要可选唯一约束，然后完成全部验证、Review 和 Closure gate。

## 预计 Implementation 文件

具体名称遵循仓库现有结构，预计变更范围：

- `src/app/api/inspections/batch/route.ts`
- `src/app/api/inspections/entry/` 下专用设备、零件与参数 Route Handler
- `src/app/api/equipment/route.ts`，仅为设备变更增加共用锁；通用 GET 权限不变
- `src/app/api/equipment/[id]/installations/route.ts`，为装配变更增加共用锁
- `src/lib/` 下聚焦 inspection integrity 的 service/policy
- 仅在冻结 contract 要求时修改既有 inspection-entry component 与 request/response type
- 现有测试布局下的 service、API、PostgreSQL 并发与授权测试
- 只有条件性唯一约束另行批准时，才修改 `prisma/schema.prisma` 并新增一个 Migration
- Implementation 后的 SPEC-001-E Review、测试证据、Issue/Closure 文档

## 主要风险

- **并发安全的错误假设：** 如果 batch、设备和装配 writer 没有统一应用父设备 `FOR UPDATE` 协议，仅把代码移动到 Transaction 内仍然无法关闭缺陷。
- **权限扩大：** 如果把 legacy owner scope 直接替换成不受限制的设备读取，将违反冻结 Data Scope；读取必须限制在既有 Inspection capability 内。
- **历史数据歧义：** 现有数据可能无法证明旧测量发生时的权威装配，nullable revision link 必须保持兼容。
- **状态与时间不一致：** `status`、`installed_at`、`removed_at` 可能矛盾；检测有效性以冻结时间谓词为准，异常应报告，不得猜测或静默修复。
- **重复约束过宽：** 跨检测记录唯一会错误阻止合法复测；唯一性只限定在单条检测记录内。
- **客户端与服务端漂移：** 修改 batch contract 时若未同步 inspection-entry UI 与 type，即使 service 正确也会破坏主流程。
- **Migration 安全：** 未审计历史冲突就增加唯一约束，可能导致部署失败或迫使破坏正式质量历史。
