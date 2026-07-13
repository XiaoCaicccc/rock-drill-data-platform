# SPEC-001-A Closure: Data Scope Authorization

状态：Completed  
实施提交：3434faa feat: implement SPEC-001-A data scope authorization  
关闭日期：2026-07-13

## 1. 目标

将原有已登录即可访问的查询边界升级为资源级授权和 Data Scope 控制，并在生产部署环境完成五角色验收。

## 2. 实际实现范围

| 模块 | 实际变更 |
| --- | --- |
| src/lib/permissions.ts | 新增 Data Scope 类型、角色 Scope 映射、资源角色矩阵、requireDataScopeResource()。 |
| /api/dashboard | 资源授权；viewer 仅返回统计，不查询设备健康或最近检测明细。 |
| /api/inspections | 资源授权和质量范围查询条件。 |
| /api/analysis/param-comparison | 资源授权；按检测记录和零件版本配对；排除未知版本数据。 |
| /api/export | 独立导出授权；导出直接走 Prisma 查询；接收与台账一致的筛选。 |
| /api/reports | 资源授权；inspector、engineer 在数据库查询中仅可见已发布报告。 |
| LedgerView | 导出传递应用中的筛选；移除检测记录删除入口。 |

## 3. 权限模型

| Role | Scope | Dashboard | Inspection | Analysis | Export | Reports |
| --- | --- | --- | --- | --- | --- | --- |
| admin | all | full | full | full | allowed | all states |
| quality_manager | quality | allowed | allowed | allowed | allowed | full |
| inspector | quality | allowed | allowed | allowed | denied | published only |
| engineer | published_reports | denied | denied | denied | denied | published only |
| viewer | dashboard_only | aggregate only | denied | denied | denied | denied |

未登录用户对五个受控查询资源均返回 401。

## 4. Data Scope 设计

- Scope 由服务端 Session 的 role 解析，不接受客户端传入的范围或身份。
- requireDataScopeResource() 在数据库查询前执行，先决定资源是否可访问。
- API 以 Prisma where 或等价条件施加 Scope；不允许先读取全量结果再过滤。
- 资源访问权和数据范围是两个维度：例如 inspector 拥有 quality Scope，但 export 资源仍被拒绝。

详见 [DEC-001 / DEC-002](../05_DECISIONS.md)。

## 5. Verification

### Static Verification

Static Verification 是当前源码与 3434faa diff 的审查，不是运行测试。

- 目标 API 均在查询前调用统一资源授权；
- 导出、报告、台账和分析在后端建立范围或状态查询条件；
- viewer Dashboard 不读取受控明细；
- 前端隐藏不承担安全职责；
- 未发现 inspection DELETE API。

### Runtime Verification

Railway 部署环境使用 admin、quality_manager、inspector、engineer、viewer 完成验收；五角色矩阵及未登录 401 均为 PASS。完整记录见 [07_TESTING.md](../07_TESTING.md)。

## 6. Release Review

| 项目 | 结果 |
| --- | --- |
| Git commit | 3434faa |
| GitHub push | 成功 |
| Railway deployment | 成功 |
| Static Verification | PASS |
| Runtime Verification | PASS |

## 7. 已知限制

- 报告样例有审核中状态，但当前状态机和 UI 不支持审核中 -> 已发布。
- Dashboard 与 Dashboard export 各自实现聚合逻辑，存在指标口径分叉风险。
- 当前 quality Scope 是阶段性质量域范围，不等同于完整组织级行隔离。
- 本地 Node/npx、Docker Compose 验证环境不稳定。

## 8. Future SPEC 输入

1. Report Workflow：定义并实现审核、发布、退回、撤回和审计闭环。
2. Audit / Traceability：覆盖更多受控对象、状态转换和文档访问。
3. Shared Query Contract：统一台账、导出、Dashboard 与报表筛选/聚合。
4. Developer Experience：修复本地 Node 与 Docker 验证环境。

## 9. 文档一致性结果

- 当前仓库原先不存在 SPEC-001-A 文档；本文件是其完成记录。
- worklog.md 的早期 Spec-001 仅描述布局导航，未与本次权限决策冲突。
- 未发现其他现有 SPEC 文档与已冻结权限矩阵冲突。
