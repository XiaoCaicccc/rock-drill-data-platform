# SPEC-001-E 最终设计审查

- 审查日期：2026-07-16
- 审查对象：`docs/specs/SPEC-001-E-inspection-business-integrity.md`
- 审查方式：只读设计审查；未修改 SPEC、源码、Prisma Schema 或 Migration
- 审查结论：**NEED REVISION**

## 结论

**NEED REVISION：当前设计尚不能进入 Implementation。**

五项历史意见中，并发控制协议、batch API contract、qualification rule 来源已经关闭；inspector inspection-entry 读取边界仍未完整关闭；`inspection_date` 虽已冻结时间有效性谓词和边界包含关系，但跨时区解析语义仍不完整。以下两项是进入 Implementation 前必须修改的设计项。

## 必须修改项

### 1. inspection-entry 缺少参数项的专用、同范围读取 contract

SPEC 第 224–239 行只定义了设备列表和设备有效装配/版本列表；但冻结业务链路还要求选择 `parameter_item`，且第 307 行的主流程明确包含“类别匹配参数选择”。当前 UI 从通用 `GET /api/parameter-templates` 读取参数，而当前实现对 inspector 使用 legacy `created_by = session.user.id` scope。因而即使新增的设备和零件专用 Route 正确，inspector 仍可能无法读取非本人创建或 `created_by = null` 的模板/参数项，无法稳定完成本 SPEC 声明要恢复的主流程。

必须在 Technical Design 中冻结参数发现方案，例如增加从属于 `inspection_ledger` 的 inspection-entry 专用参数读取 Route，或明确改造一个等价的窄读取入口。设计至少应明确：

- 请求参数（至少包含权威 category identity）及严格响应字段；
- 与 batch 相同的 `inspection_ledger` 资源授权、六身份矩阵和数据库查询前授权；
- `quality` scope 下不得应用 template creator ownership，且不得扩大模板管理、通用模板读取或写权限；
- 只返回构造 batch 所需的参数 ID、显示字段、数据类型和必要限值，不暴露管理元数据；
- UI 必须使用该入口，并有其他 creator / null creator 模板的 PostgreSQL API 与直接绕过测试；
- Acceptance Criteria 应把参数发现纳入 inspector 端到端主流程和最小字段断言。

在该 contract 冻结前，历史 NEED REVISION“inspector inspection-entry 读取边界”不能视为关闭，Technical Design 也不足以让开发人员直接实现完整主流程。

### 2. 冻结 `inspection_date` 的时区与规范化语义

SPEC 已明确 `installed_at <= inspection_date AND (removed_at IS NULL OR removed_at > inspection_date)`、未来时间拒绝以及两个读取 Route 与 batch 使用同一时点，这是必要且正确的修订。但“有效 ISO-8601 时间戳”仍允许实现者对无 offset 的时间字符串、解析失败、精度和规范化方式作不同解释。Node 运行时、客户端本地时区和 PostgreSQL 会话时区的差异可能导致 inspection-entry 发现结果与 batch 写入结果不一致。

必须明确：

- 是否只接受带 `Z` 或显式 UTC offset 的 RFC 3339/ISO-8601 timestamp；建议拒绝无 offset 的本地时间字符串；
- Route、service 和数据库谓词使用的唯一规范化形式（建议解析为同一 UTC instant）；
- “不得晚于服务器时间”的比较精度及是否存在明确容差；
- inspection-entry query 参数与 batch body 使用完全相同的解析/校验 helper 和错误 code；
- 自动化测试覆盖 `Z`、正负 offset、等价 instant、无 offset、无效日期、服务器时区变化及未来边界。

在这些语义冻结前，历史 NEED REVISION“inspection_date 时间语义”只部分关闭，并仍存在可测试性与跨环境一致性风险。

## 历史 NEED REVISION 复核

| 历史问题 | 结果 | 审查说明 |
| --- | --- | --- |
| 并发控制协议 | CLOSED | 第 107–136 行冻结父设备 `FOR UPDATE` 串行化点、装配行稳定加锁顺序、所有相关 writer 共用协议、Transaction 内重校验、可重试错误范围、最多三次完整尝试及审计原子性。 |
| inspector inspection-entry 读取边界 | OPEN | 设备与装配读取边界已收窄，但缺少参数项发现边界，不能完成冻结主流程。 |
| `inspection_date` 时间语义 | PARTIALLY CLOSED | 有效装配谓词及等号边界已冻结；时区/offset/规范化仍未冻结。 |
| batch API contract | CLOSED | 第 155–202 行明确严格请求结构、1–500 限制、未知/禁止字段、派生字段、稳定错误码、201 响应和全有或全无行为。 |
| qualification rule 来源 | CLOSED | 第 144–153 行明确复用当前 `parameter_item` 上下限规则，并冻结 inclusive boundary、null、文本与 overall result 语义。 |

## 其他审查项

### 新设计漏洞

除上述两项必须修改项外，未发现新的独立阻断性设计漏洞。参数发现缺口会直接破坏 FLOW-001 主流程；时间解析缺口会造成读取/写入谓词漂移，因此均不能留给 Implementation 自行决定。

### Technical Design 可实施性

锁顺序、Transaction 边界、关系不变量、派生字段、错误 contract、重试规则和基线无 Migration 方案已足够具体。参数读取 contract 与时间解析 contract 补齐后，设计可达到直接实现要求。

### Acceptance Criteria 可测试性

现有 AC 4–16 基本可自动化验证，尤其覆盖链路、原子性、重复项、并发、授权和历史兼容。AC 1–3 因未定义参数发现入口而不能完整证明 inspector 主流程；时间相关 AC 也缺少 offset/时区测试。应随两项必须修改项补齐。

### SPEC-001-A / SPEC-001-D 冻结规则

设计正确保留 `inspection_ledger` 统一资源授权、查询前授权、Data Scope 进入数据库谓词、服务端权威 session、401/403 区分及通用设备管理权限不变。未发现主动修改 A/D 冻结矩阵的条款。参数读取修订必须继续复用统一资源授权，不能通过放宽通用模板 API 解决。

### 权限扩大风险

设备/装配专用读取采用最小字段且不授权管理操作，方向正确。主要剩余风险是实现者为解决参数发现而直接放宽通用 `/api/parameter-templates`；必须通过新增或冻结窄入口消除该自由度。除此之外未发现新的角色、导出、报告、Dashboard 或管理权限扩大。

### Migration 风险

基线明确不需要 Migration，保留历史 nullable 字段，不回填、不修改正式记录和既有 Migration，风险控制合理。可选唯一约束被正确置于只读历史审计和单独批准之后。未发现基线 Migration 阻断项。

### 并发设计

父设备行作为新增、拆卸、替换、设备更新/删除和 batch 的共同串行化点，可以关闭装配状态 TOCTOU；稳定锁顺序、Transaction 内权威重读、Serializable 重试及 record number 冲突处理均有可验证 contract。Acceptance Criteria 也要求 PostgreSQL 受控并发测试。未发现新的并发设计漏洞。

## 最终结论

**NEED REVISION**

必须修改：

1. 补齐 inspection-entry 参数项发现的窄范围授权、API、字段和测试 contract。
2. 冻结 `inspection_date` 的 offset、UTC 规范化、未来比较精度以及读取/写入共用解析规则和测试。

完成上述修订后，应再次执行最终设计审查；在获得 `PASS` 前不得进入 Implementation。
