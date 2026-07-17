# SPEC-001 剩余阻塞问题审查（Remaining Blockers Review）

- 评估日期：2026-07-16
- 评估范围：`FLOW-001`、`REPORT-001`、`DATA-001`、`ANALYSIS-001`
- 评估基线：HEAD `830ebec`（`docs: sync current state after SPEC-001-D security review`）
- 评估方式：当前源码、Prisma schema、既有 SPEC/Review/Closure 文档与测试目录的只读静态复核
- 修改边界：未修改源码、现有文档或 migration；本文件是本次审计唯一新增文件

## 1. 总体结论

**结论：四项问题在当前 HEAD 均可复现，仍然阻塞 SPEC-001 Closure。**

建议把原 `REVIEW-DECISIONS.md` 中将 `FLOW-001`、`DATA-001`、`ANALYSIS-001` 全部放入 `SPEC-001-E Quality Data Integrity` 的规划重新拆分为三个窄范围修复 SPEC：

| 推荐 SPEC | 关闭问题 | 决定 |
|---|---|---|
| `SPEC-001-E Inspection Business Integrity` | `FLOW-001` | 单独处理。它是检测写入链和 inspector 主流程的业务完整性问题，不应与统计公式修复混为一个验收边界。 |
| `SPEC-001-F Report Publication Consistency` | `REPORT-001` | 单独处理。它保护报告生命周期、并发写入和发布不可变性。 |
| `SPEC-001-G Quality Metrics Correctness` | `DATA-001`、`ANALYSIS-001` | 合并处理。两项均属于质量指标语义与边界条件正确性，可共享指标定义、确定性数据集和 PostgreSQL/API 回归门禁。 |

这三个 SPEC 是实现与验收边界，不代表数据完全无关。推荐实施顺序为 `E → G → F`，随后重新执行 SPEC-001 Review 和 Closure。`E` 先恢复可信检测事实；`G` 再验证这些事实的聚合/分析语义；`F` 最后确认引用这些事实和分析标识的正式报告不会被并发编辑破坏。

## 2. Closure 判定依据

当前权威决策规定：所有阻塞问题关闭、修复后重新 Review、完成 SPEC-001-C 工程尾项并重新确认 Closure，才可关闭 SPEC-001。`CURRENT_STATE.md` 和 `SPEC-001-D-FINAL-REVIEW.md` 仍明确把本次四项列为剩余阻塞问题。

本次复核没有发现四项对应代码已被修复，也没有发现覆盖相应失败场景的专项回归测试。因此不能仅依据 MVP 功能可用、Dashboard 与导出结果一致、报告发布事务存在，或正常 UI 路径可操作而降级这些问题。

## 3. 当前问题事实确认

### 3.1 FLOW-001——已确认 / 仍然阻塞

#### 当前事实

1. `src/app/api/inspections/batch/route.ts:23-30` 分别查询设备、零件版本和参数项；零件版本查询只选择 `id`、`part_id`、`lifecycle_state`，参数项查询不带模板类别。
2. `src/app/api/inspections/batch/route.ts:34-45` 只验证零件版本存在且为 `released`、参数项存在；未验证：
   - `part_revision` 是否是目标 `equipment` 当前有效装配；
   - `parameter_item.template.category_id` 是否与 `part.category_id` 一致；
   - 同一提交中是否出现业务上不允许的重复测量组合。
3. `src/app/api/inspections/batch/route.ts:51-58` 虽使用 Serializable Transaction，但上述关系校验发生在 Transaction 外，而且 Transaction 内部只创建记录与明细。Serializable 隔离级别本身不会补足未表达的业务不变量，也不能防止校验后装配状态变化的 TOCTOU 窗口。
4. Prisma schema 已有 `equipment_part_installation`、`part_revision → part → category`、`parameter_item → parameter_template → category` 所需关系，但 `inspection_data_item` 的外键只能分别保证对象存在，不能保证这些对象属于同一设备—装配—类别链。
5. `src/app/api/equipment/route.ts:31-40` 对普通角色应用 legacy owner scope；`src/app/api/equipment/[id]/parts/route.ts:8-16` 对装配读取执行 owner/admin 校验。`inspector` 虽被允许调用批量检测写入，却不能稳定读取非本人创建的设备和装配。历史/种子设备的 `created_by = null` 时该路径尤其无法闭环。

#### Closure 判断

**仍然阻塞。** 当前 API 可产生结构上外键有效、业务上错误的正式质量记录；同时被授权执行检测写入的 `inspector` 主流程并不具备一致的设备/装配读取能力。问题同时影响数据正确性、权限范围和核心角色可完成性，属于严重阻塞问题，而非普通 UI 缺陷。

### 3.2 REPORT-001——已确认 / 仍然阻塞

#### 当前事实

1. `src/app/api/reports/route.ts:150-159` 先读取报告并检查当时状态为草稿。
2. 来源校验、零件版本查询和更新数据组装发生在该检查之后；`src/app/api/reports/route.ts:187-190` 最终执行的 `analysis_report.update({ where: { id } })` 没有把“状态仍为草稿”放入写条件，也未与检查放入同一事务。
3. 与之对照，`src/lib/report-workflow.ts:168-176` 的提交/退回和 `:247-253` 的发布都使用 `updateMany({ where: { id, status: oldStatus } })` 做状态竞争检测。
4. 因此草稿编辑与提交/发布并发时，编辑请求可在状态转换成功后继续覆盖当前报告正文、`source_context` 或零件版本链接。发布事务创建快照并不能阻止当前行被随后覆盖；列表 GET 当前返回 `analysis_report` 当前行而非以发布快照作为已发布内容的权威读模型。

#### Closure 判断

**仍然阻塞。** 它破坏“仅草稿可编辑”和“已发布内容不可变”的正式记录保证，并可能造成发布快照与用户当前看到内容不一致。

### 3.3 DATA-001——已确认 / 仍然阻塞

#### 当前事实

1. `src/app/api/dashboard/route.ts:51-56` 的总量和本月量使用 `inspection_record.count()`，业务对象是检测记录。
2. 同一路由 `:87-98` 的月度趋势却将 `inspection_record` JOIN `inspection_data_item` 后使用 `COUNT(*)`；一条含 N 个明细的检测记录被计为 N。
3. `src/app/api/export/route.ts:153-162` 复制了相同 SQL，因此 Dashboard 与 CSV 是“一致地错误”。
4. `src/components/dashboard/DashboardView.tsx:176-203` 和导出 CSV 表头均把该值明确展示为“检测数”，不是“检测数据项数”。
5. 当前合格率的分母使用明细项是另一项可成立的业务口径；问题在于同一个月度序列中的 `count` 标签/定义与 SQL 粒度不一致，不能通过简单把所有 `COUNT(*)` 改为记录数来处理，必须分别冻结“检测数”和“测量项合格率”的口径。

#### Closure 判断

**仍然阻塞。** Dashboard/导出是质量决策输出，当前会按每条记录的明细数放大检测量；既有“查询/导出一致性”不能证明业务口径正确。

### 3.4 ANALYSIS-001——已确认 / 仍然阻塞

#### 当前事实

1. `src/app/api/analysis/param-comparison/route.ts:141-154` 在配对样本数至少为 2 时计算 Pearson 相关系数。
2. 当任一序列零方差导致分母为 0 时，当前表达式 `denominator === 0 ? 0 : ...` 返回数值 `0`。
3. Pearson 相关系数在该条件下不可定义；数值 0 则表示已计算且无线性相关，两者业务语义不同。
4. 当前没有稳定的不可计算原因码，也未发现零方差专项回归测试，因此 UI/调用方无法可靠地区分“无线性相关”“样本不足”和“零方差不可计算”。

#### Closure 判断

**仍然阻塞。** 参数分析会把不可计算结果表达成有效工程结论，属于质量分析正确性问题。

## 4. 合并关系评估

### 4.1 FLOW-001 是否应单独成为业务完整性 SPEC

**是。** `FLOW-001` 跨越设备可见范围、有效装配、发布零件版本、类别模板、参数项和检测明细写入，核心是“哪些业务对象允许共同形成一条质量记录”。它需要服务端 policy/service、同事务关系校验、直接 API 绕过测试和 inspector 端到端验收。其失败模式、权限矩阵和测试夹具均明显大于两个统计公式问题。

若把它与 `DATA-001`/`ANALYSIS-001` 放在同一 SPEC，容易出现公式已修复但检测事实仍不可信，或为了等待复杂业务流而扩大一个本可独立验证的指标修复。故建议将原计划的 `SPEC-001-E Quality Data Integrity` 收窄并改名为 `Inspection Business Integrity`。

### 4.2 REPORT-001 与 FLOW-001 是否有数据关系

**有上游/下游数据关系，但没有共同的原子不变量，不建议合并实现。**

- 报告的 `source_context.inspection_record_ids` 和 `analysis_identifiers` 以及零件版本链接，会引用检测/分析事实；若 `FLOW-001` 未修复，报告可能忠实快照一组业务上不可信的检测来源。
- `REPORT-001` 的直接缺陷却是报告行状态与内容更新之间的并发控制。即使所有检测数据完全正确，该竞争窗口仍存在；即使报告并发修复，错误关联的检测记录也不会自动变正确。
- 两项共享的仅是端到端验收依赖：报告发布验收应使用通过 `FLOW-001` 规则创建的合法检测记录，并确认来源追溯未被编辑竞争破坏。

因此推荐 `E` 与 `F` 分开，`F` 在验收数据准备上依赖 `E`，但不把 `E` 的关系校验复制进报告工作流。

### 4.3 DATA-001 与 ANALYSIS-001 是否可合并

**可以，且推荐合并为 `SPEC-001-G Quality Metrics Correctness`。** 两项都不改变业务写入状态机，目标都是冻结质量数字的定义、不可计算语义和边界条件；可共享：

- 一个小型且确定性的 PostgreSQL 质量数据集；
- 指标词汇表与 API contract；
- Dashboard/API/CSV/分析结果的跨出口一致性测试；
- 多明细单记录、空集、少样本、零方差等边界用例；
- Node 20 + PostgreSQL CI 门禁。

合并不代表把两段计算揉成一个模块；它们仍应有独立验收用例和独立 issue closure 证据。

## 5. 推荐修复 SPEC

### 5.1 SPEC-001-E Inspection Business Integrity

#### 范围

- 冻结“设备—当前有效装配—已发布零件版本—零件类别—参数模板—参数项—检测记录/明细”的服务端业务不变量。
- 明确 `inspector` 对检测录入所需设备与当前装配的只读范围；不得继续用设备 `created_by` owner 规则意外阻断其被授权的检测主流程。
- 将所有关系校验和检测记录/明细创建放入同一数据库事务，避免装配状态在校验与写入之间变化。
- 校验提交的每个零件版本确实为目标设备在检测时点允许使用的有效装配，参数项属于该零件类别的受控模板。
- 明确并校验同一记录内重复的 `(part_revision_id, param_item_id)` 是否禁止；推荐禁止并返回 409。
- 统一由服务端从权威关系派生 `part_id`、`user_id` 和判定结果，不信任客户端身份或冗余关系字段。
- 补充直接 API 绕过、并发装配变化、`inspector` 主流程和审计日志回归。

#### 范围外

- 新的设备、零件、模板管理功能或路由。
- 修改零件发布生命周期本身。
- 重算/清洗所有历史检测记录；历史异常只做只读识别和后续处置建议，除非另行批准数据修复方案。
- Dashboard 指标、Pearson 公式和报告生命周期修复。
- 重设计整个角色—资源矩阵。

#### 数据模型影响

- 首选复用现有 `equipment_part_installation`、`part_revision`、`part`、`parameter_template`、`parameter_item` 关系；核心修复可在 Service/Policy 和 Transaction 查询中完成。
- 应在 SPEC 设计阶段明确“检测时点有效装配”的判定：`installed_at <= inspection_date` 且 `removed_at` 为空或晚于检测时点；若当前业务只允许 status=`active`，也必须写入冻结规则。
- 需要评估历史允许同一记录重复测量同一参数的业务含义。若禁止重复且历史数据无冲突，可考虑数据库唯一约束；若需要复测序号，则应另行设计 measurement sequence，不能在本修复中猜测。

#### 权限影响

- 有。需为 `inspector` 建立“检测录入所需设备/当前装配只读”能力，同时保持设备编辑、装配变更仍由既有管理角色控制。
- 所有写入身份以服务端会话为准；客户端 `inspector` 文本可作为业务显示字段，但不能代替 `user_id` 授权主体。
- 直接 POST 必须与 UI 取得相同的设备/装配范围，前端隐藏不是授权边界。

#### Migration 影响

- **基线方案：不要求 Migration。** 当前 schema 已能表达关系，服务端 Transaction 校验即可关闭主要缺陷。
- **条件性 Migration：** 只有在数据审计证明无冲突且业务确认禁止重复测量后，才新增唯一约束/索引；必须通过新的 Prisma Migration，并先设计历史数据检查与回填/冲突处置。不得修改已有 Migration。

#### 验收标准

1. 合法 `inspector` 可读取其检测录入所需的设备与当前装配，并完成一次从选择设备到保存检测记录的主流程。
2. 任意角色直接调用 API，将未装配零件版本写入设备检测时返回 4xx，且数据库无部分记录。
3. 使用非 released 零件版本、错误类别参数项、不存在对象、移除/过期装配均返回确定性 4xx，且无部分写入。
4. 校验与创建位于同一事务；模拟校验期间装配变化时，不产生违反冻结规则的记录。
5. 服务端派生的 `part_id` 与 `part_revision.part_id` 一致，`user_id` 等于当前权威会话用户。
6. 重复测量策略有明确 contract，并有允许/拒绝回归测试。
7. admin、quality_manager、engineer、inspector、viewer、未登录六身份的设备/装配读取与 batch write 结果符合冻结矩阵。
8. 关键成功写入与拒绝场景不泄露敏感数据；成功写入保留可复核审计记录。
9. 针对性测试、typecheck、lint、build（因跨 API/service/Prisma 边界）及 PostgreSQL CI 全部通过。

### 5.2 SPEC-001-F Report Publication Consistency

#### 范围

- 将草稿内容、来源上下文和零件版本链接的编辑收口到报告 Service/Workflow 层。
- 使“状态仍为草稿”成为数据库写入前置条件，并把状态检查、内容/链接更新和审计放入同一事务。
- 对编辑与提交、编辑与发布、双重编辑建立确定性竞争测试；失败方返回 409，不得覆盖 reviewing/published 内容。
- 明确已发布报告的权威读模型：推荐已发布状态展示 publication snapshot，或证明当前行在数据库层不可再变并对快照一致性建立断言。
- 同步保护草稿删除的检查—删除竞争，避免同类 TOCTOU 缺陷留在同一路由。

#### 范围外

- 检测写入关系完整性、质量指标公式修复。
- 新报告类型、富文本编辑器、模板设计或归档功能。
- 改变既有报告角色矩阵和审批状态集合。
- 把自由文本 `analysis_identifiers` 扩展成完整 Analysis Result identity 模型；该事项继续作为独立后续 SPEC。

#### 数据模型影响

- 现有 `analysis_report.status`、`analysis_report_snapshot` 和 `analysis_report_part_revision` 足以实现条件更新与事务一致性。
- 需要冻结 snapshot 与当前行的权威关系，并保证 content/source snapshot 对应同一发布前版本。

#### 权限影响

- 不改变既有角色集合；仍只有报告工作流写角色可编辑/提交/发布。
- 每次事务入口继续使用服务端权威会话与当前数据范围，来源校验不得信任客户端用户/组织字段。
- 已发布报告的读取范围保持既有 published-only/quality scope 规则。

#### Migration 影响

- **预计无 Migration。** 可用 Transaction、条件 `updateMany` 和既有唯一 `snapshot.report_id` 完成。
- 若选择显式乐观锁版本列，才需要新 Migration；该方案不是关闭本问题的必要条件。

#### 验收标准

1. 非草稿编辑和删除均返回 409，数据库正文、来源、链接、状态、快照不变。
2. 草稿编辑与提交并发时最多一个按其前置状态成功；若提交成功，迟到编辑必须失败且 reviewing 内容不被覆盖。
3. 草稿编辑与发布并发时，发布成功后迟到编辑必须失败；当前展示内容与 publication snapshot 一致。
4. 双重发布只产生一个 snapshot、一次有效状态转换和一组一致审计记录。
5. 内容、`source_context`、零件版本链接和审计在同一事务内成功或回滚。
6. 发布读取的权威来源有自动化断言；不得出现 snapshot 与 UI/API 展示正文不一致。
7. admin、quality_manager、engineer、inspector、viewer、未登录六身份的编辑/提交/发布/读取结果符合冻结矩阵。
8. PostgreSQL 真实事务并发测试、针对性单元/API 测试、typecheck、lint、build 和 CI 通过。

### 5.3 SPEC-001-G Quality Metrics Correctness

#### 范围

- 冻结以下业务定义：检测记录数、检测数据项数、数据项合格率、Pearson correlation、不可计算状态及原因。
- 修正 Dashboard 和 CSV 月度“检测数”为按 `inspection_record` 粒度计数，同时保持合格率分子/分母采用已冻结的数据项口径。
- 消除 Dashboard 与导出中重复 SQL 漂移风险；复用共享查询/指标 contract 或以等价 contract tests 锁定结果。
- 零方差 Pearson 返回不可计算结果（推荐 `correlation: null` + 稳定 reason code `ZERO_VARIANCE`），不得返回 0。
- 明确少于两个有效配对、空集、非有限值和零方差的 API contract 与 UI 展示。
- 用确定性 PostgreSQL fixture 覆盖多明细单记录、跨月记录、部分合格、少样本和零方差。

#### 范围外

- 检测记录写入关系完整性和 inspector 设备范围。
- 报告生命周期/快照并发。
- 引入新的统计模型、显著性检验、置信区间或图表重设计。
- 历史数据重算或持久化派生指标；当前指标为查询时计算。
- 修正未在本次 issue 中确认的其他 Dashboard 产品口径，发现后另行记录。

#### 数据模型影响

- 无持久化模型变更。指标语义应通过 TypeScript response contract、共享查询和测试 fixture 固化。
- `monthlyTrend.count` 保持数字字段但明确表示记录数；合格率继续明确表示数据项级比例。
- 分析响应需能表达 `null` 与稳定不可计算原因，避免用数值哨兵混淆统计结论。

#### 权限影响

- 不改变 SPEC-001-A/D 已冻结的 dashboard、export、analysis 访问矩阵和数据范围。
- 修复后的共享查询必须继续在数据库查询前应用服务端数据范围；不得为复用统计逻辑而退化成查全量后过滤。
- Dashboard 与 CSV 对同一身份、同一范围、同一时间窗口必须一致。

#### Migration 影响

- **无 Migration。** 查询聚合与响应语义修复不需要 schema 变化，也不应借此创建持久化指标表。

#### 验收标准

1. fixture 中一个月有 2 条检测记录、分别含 3 和 5 个明细时，月度 `count = 2`，不是 8。
2. 同一 fixture 的合格率按已冻结的数据项分母计算，并与明确的手工期望值一致。
3. Dashboard API、UI 标签和 CSV 对月份、检测记录数、合格率使用相同定义和结果。
4. 无明细记录是否计入“检测数”必须在 contract 中明确；推荐计入记录数，但不进入数据项合格率分母，并有测试。
5. 任一输入序列零方差时 correlation 为 `null` 且 reason 为 `ZERO_VARIANCE`（或等价稳定枚举）；UI 显示“不可计算”，不得显示 `0` 或“无线性相关”。
6. 有方差且完全正相关、完全负相关、近似无相关各有已知结果测试；空集/少于两个配对有独立原因语义。
7. 六身份对 dashboard/export/analysis 的授权与数据范围回归不变。
8. 针对性 API/query tests 在临时 PostgreSQL 通过，并完成 typecheck、lint、build 和 Node 20 CI。

## 6. Closure 与实施门禁

四项问题的关闭应分别有可复核证据，不能以对应 SPEC 合并通过来模糊单项状态：

1. `SPEC-001-E` 验收通过后关闭 `FLOW-001`。
2. `SPEC-001-F` 验收通过后关闭 `REPORT-001`。
3. `SPEC-001-G` 中两组独立验收均通过后，分别关闭 `DATA-001` 与 `ANALYSIS-001`。
4. 三个 SPEC 均完成后，重新执行包含直接 API、真实 PostgreSQL Transaction/聚合和六身份矩阵的 SPEC-001 Review。
5. 同时满足既有 Closure Rule 中的 SPEC-001-C 工程尾项与 Closure 文档重确认，方可将 SPEC-001 标为 Closed。

## 7. 本次验证记录与限制

- 已静态复核上述路由、workflow、Prisma schema、Review Decision、Current State 和现有测试索引。
- 未运行测试、typecheck、lint 或 build：本任务是只读重新评估，且没有实现改动需要验证。
- 未连接数据库、GitHub Actions 或 Railway；因此未把外部运行状态作为本次关闭证据。
- 工作树在审计开始前已有两个与本任务无关的未跟踪文件：`docs/review/SPEC-001-D-CLOSURE.md`、`docs/review/SPEC-001-D-RUNTIME-VERIFICATION.md`。本次未修改它们。
- 本报告确认的是当前代码缺陷与修复 SPEC 边界，不授权历史数据清洗、schema 变更或生产数据操作。
