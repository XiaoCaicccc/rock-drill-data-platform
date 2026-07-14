# SPEC 管理

## 文件约定

- SPEC-XXX-*.md：可实施、可验收的规格。
- SPEC-XXX-*-CLOSURE.md：该 SPEC 的完成事实、验证证据、限制和后续输入。
- SPEC_TEMPLATE.md：新 SPEC 的统一模板。

## 当前记录

- [SPEC-001-A Closure](./SPEC-001-A-CLOSURE.md)
- [SPEC-001-B Report Workflow](./SPEC-001-B-report-workflow.md)
- [SPEC-001-B Closure](./SPEC-001-B-CLOSURE.md)
- [SPEC 模板](./SPEC_TEMPLATE.md)

## 编写原则

- 一份 SPEC 只解决一个可独立验收的问题。
- 权限决策在实现前冻结；任务描述与已冻结决策冲突时，以冻结决策为准。
- Static Verification 与 Runtime Verification 必须分别记录。
