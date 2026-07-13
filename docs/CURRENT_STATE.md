# 当前项目状态

更新时间：2026-07-13

## 产品定位

rock-drill-data-platform 是面向凿岩机质检部门的质量数据管理与分析平台，正在从部门质量数据平台向受控质量 PLM 演进。

## Milestone

### M1 Authorization Foundation

状态：Completed

Achievement：

- RBAC：admin、quality_manager、inspector、engineer、viewer；
- Data Scope：角色与资源访问权分离，统一由服务端解析；
- API authorization：Dashboard、检测台账、参数分析、导出、报告已接入查询前授权；
- Runtime verification：Railway 环境五角色验收已记录为通过；
- Documentation closure：SPEC-001-A 的决策、验证、问题和流程已归档。

详情见 [SPEC-001-A Closure](./specs/SPEC-001-A-CLOSURE.md)。

## 当前冻结规则

- requireDataScopeResource() 必须在数据库查询前执行。
- 数据范围必须进入 Prisma where 或等价查询条件，禁止查全量后在内存或前端过滤。
- 前端隐藏按钮仅改善体验，不能构成授权边界。
- SPEC-001-A 的角色 - 资源 - 动作矩阵已经冻结。

## Next

1. Report Workflow：补齐报告 reviewing -> published 的审批与发布闭环。
2. Audit / Traceability：扩大关键对象、状态转换和文件访问的审计与追溯范围。
3. Shared Query Contract：收敛 Dashboard、台账、导出之间的筛选与统计口径。

## 文档一致性检查结果

- 当前仓库原先没有 docs；未发现需要迁移或合并的旧文档体系。
- worklog.md 中的早期 Spec-001 是全局布局与导航框架，并非本次 SPEC-001-A，历史状态不应被误改。
- 当前仓库未发现其他 SPEC 文档与冻结后的权限矩阵相冲突。
