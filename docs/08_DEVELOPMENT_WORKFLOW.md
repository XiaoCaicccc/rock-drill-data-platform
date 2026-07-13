# 开发流程

## 标准交付链路

SPEC -> Implementation -> AI Coding Agent -> Code Review -> Static Verification -> Git Commit -> Deployment -> Runtime Verification -> Closure Documentation

## 阶段要求

### 1. SPEC

- 明确业务目标、范围、数据模型影响和 Out of Scope。
- 涉及权限时，先冻结角色 - 资源 - 动作 - 范围。
- 明确 Given / When / Then 验收标准与运行时验证计划。

### 2. Implementation 与 AI Coding Agent

- AI 负责在冻结范围内实现、辅助静态检查和整理文档。
- 人工负责需求判断、领域边界、架构决策和最终验收。
- AI 不得自行扩大范围、修改冻结权限，或用前端显隐代替后端授权。
- 发现需求冲突时，停止实现并回到 SPEC/Decision 层澄清。

### 3. Code Review 与 Static Verification

- 审查 diff、权限入口、数据库 where、状态机、审计和输入边界。
- 区分源码中存在检查与真实环境行为正确；前者不能替代后者。
- 检查导出、列表、分析和报表是否使用一致的筛选与数据范围。

### 4. Git Commit 与 Deployment

- 先检查 diff、敏感文件和环境变量，再提交。
- 部署后以实际部署日志与页面/API 行为为准。
- 本地环境不可用时可以临时使用 Railway 做验收，但必须将环境故障记入 Issue，不能把生产环境当作永久唯一验证路径。

### 5. Runtime Verification

- 使用真实角色账号验证允许、拒绝、状态码和返回内容。
- 既验证能否访问，也验证访问后是否泄露不该看到的字段、明细或未发布内容。
- 每个失败或新发现必须进入 Issue；不要在验收期间无记录地修改需求口径。

### 6. Closure Documentation

- 更新 SPEC 状态、决策、测试记录、当前状态和开放问题。
- 区分已完成事实、已知限制、Deferred Future Feature 和环境问题。
- Closure 只能关闭当前范围，不自动关闭后续流程或技术债。
