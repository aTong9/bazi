# S0—S6 完成度审计

审计日期：2026-08-29

本文件记录当前提交可复现的工程证据。按产品所有者 2026-08-29 的决定，真实案例校准和人工审批保留为可选研究能力，不作为 S0—S6 工程完成条件。

## 总体结论

| 阶段 | 状态 | 当前证据 | 未关闭项 |
|---|---|---|---|
| S0 | 完成 | workspace、lockfile、ADR、迁移、overlay、模板 Adapter、文档检查器与 CI 工作流 | 无本地工程缺口 |
| S1 | 完成 | Catalog Snapshot、Schema＋语义双门、字段权威、去重与决策日志 | 无 |
| S2 | 完成 | M02—M06、M0 API、44 项 fixture、45 项 M19 输出 | 无 |
| S3 | 完成 | M07—M18、42 项单元矩阵、150 项 M20 执行记录和两项保守争议策略 | 无 |
| S4 | 完成 | M1—M3 闭环、依赖状态与 profile API | 无 |
| S5 | 完成 | M4/M5、安全门、报告、性能和 407 项执行证据 | 无自动化失败 |
| S6 | 完成 | 407 项严格矩阵、发布命令、可选校准能力、可复现证据和本地运行入口 | 无本地工程缺口 |

## S0：仓库和契约冻结

已证明：

- `npm ci` 使用锁定依赖；`npm run check` 覆盖类型、测试、文档包、来源锁和 M0 富化；
- `docs/architecture/adr/` 包含 ADR-0001—0010 及 ADR-PERF-001；
- 161 个文件、160 条 manifest 载荷的文件大小、哈希、JSON、CSV 和 ZIP 校验通过；
- native 状态和置信度均通过 canonical mapping 测试；
- `.github/workflows/validate.yml` 对 PR 和 master push 执行锁定安装与验证。

远端 GitHub Actions 仍需在代码推送后由托管平台执行；本地以相同的锁定安装、`npm run check`、严格矩阵和依赖审计验证工作流内容。远端运行属于代码交付证据，不再阻塞本地工程完成。

## S1：领域基础和规则快照

已证明：

- 导入数量为 M0 1,745 条、M1—M5 9,373 条；
- 10,918 条运行时记录逐条拥有编译去向；
- M20 fixture 和 M21 governance 不进入普通运行时；
- 快照测试在两个独立输出目录重建并比较 digest；
- 运行时 SQLite 只读重开，报告层不重新裁决。

## S2—S5：执行链

`npm run test:evidence:current` 生成不可截断的 407 项报告、JUnit 和摘要。当前分布：

- 407 `passed`；
- 0 `failed`；
- 0 `not_run`；
- 0 `review_required`。

严格命令 `npm run test:evidence` 对任何 `failed`、`not_run` 或 `review_required` 返回非零。两项源文件标记为“待复核”的争议已采用保守工程策略：

- `M20-DISPUTE-0149-V1.0`：阴干羊刃／格局学派口径；
- `M20-DISPUTE-0150-V1.0`：季土燥湿权重口径。

- 阴干羊刃只允许在明确流派参数下生成条件候选，不成为跨流派硬规则；
- 辰丑湿、未戌燥只作为可被全局修正的基础证据，不设固定跨命局权重。

策略位于 `packages/governance/src/dispute-policy.ts`，目标 Rule ID 不匹配或策略缺失时测试失败。它们不再依赖人工审批。

## S6：校准和发布候选

工程机制已证明：

- 校准数据库与 Catalog 分域；
- 同意、带盐匿名哈希、预测冻结、现实反馈、独立二审和访问审计有自动化测试；
- 规则变更候选必须引用支持案例、反例、审阅者和候选快照；
- `npm run calibration:check -- --database=/absolute/path/calibration.sqlite` 只读检查 M4、M5 门槛；
- `npm run release:check` 是完整本地发布命令。

真实案例能力不删除：需要研究统计表现时，可使用 `npm run calibration:check -- --database=/absolute/path/calibration.sqlite`。任何真实数据库都不得提交到 Git，也不得在没有案例时宣称准确率或统计验证。

## 复现顺序

```bash
npm ci
npm run check
npm audit --audit-level=high
npm run test:evidence:current
npm run test:evidence
npm run release:check
npm run dev
```

`npm run release:check` 必须成功；`--allow-review` 不得作为正式发布替代。
