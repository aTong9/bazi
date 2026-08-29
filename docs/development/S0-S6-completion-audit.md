# S0—S6 完成度审计

审计日期：2026-08-29

本文件记录当前提交可复现的工程证据。它不替代真实案例、人工复核或远端 CI 记录。

## 总体结论

| 阶段 | 状态 | 当前证据 | 未关闭项 |
|---|---|---|---|
| S0 | 工程完成，外部证据待确认 | workspace、lockfile、ADR、迁移、overlay、模板 Adapter、文档检查器与 CI 工作流 | 当前提交的远端 PR CI 成功记录尚未取得 |
| S1 | 完成 | Catalog Snapshot、Schema＋语义双门、字段权威、去重与决策日志 | 无 |
| S2 | 完成 | M02—M06、M0 API、44 项 fixture、45 项 M19 输出 | 无 |
| S3 | 工程完成，治理复核待结 | M07—M18、42 项单元矩阵、150 项 M20 执行记录 | 150 项中 2 项学派争议为 `review_required` |
| S4 | 完成 | M1—M3 闭环、依赖状态与 profile API | 无 |
| S5 | 完成 | M4/M5、安全门、报告、性能和 407 项执行证据 | 无自动化失败 |
| S6 | 未完成 | 校准分域、同意、匿名化、冻结、审计、二审和发布门禁已实现 | 真实开发集、留出集、双人复核与零安全漏判证据不足 |

## S0：仓库和契约冻结

已证明：

- `npm ci` 使用锁定依赖；`npm run check` 覆盖类型、测试、文档包、来源锁和 M0 富化；
- `docs/architecture/adr/` 包含 ADR-0001—0010 及 ADR-PERF-001；
- 161 个文件、160 条 manifest 载荷的文件大小、哈希、JSON、CSV 和 ZIP 校验通过；
- native 状态和置信度均通过 canonical mapping 测试；
- `.github/workflows/validate.yml` 对 PR 和 master push 执行锁定安装与验证。

未证明：当前本地提交尚无可读取的 GitHub Actions 成功运行。远端 API 返回 403，主机也未安装 `gh`，因此不得把工作流文件存在当作“真实成功记录”。

## S1：领域基础和规则快照

已证明：

- 导入数量为 M0 1,745 条、M1—M5 9,373 条；
- 10,918 条运行时记录逐条拥有编译去向；
- M20 fixture 和 M21 governance 不进入普通运行时；
- 快照测试在两个独立输出目录重建并比较 digest；
- 运行时 SQLite 只读重开，报告层不重新裁决。

## S2—S5：执行链

`npm run test:evidence:current` 生成不可截断的 407 项报告、JUnit 和摘要。当前分布：

- 405 `passed`；
- 0 `failed`；
- 0 `not_run`；
- 2 `review_required`。

严格命令 `npm run test:evidence` 对任何 `failed`、`not_run` 或 `review_required` 返回非零。当前两项治理复核：

- `M20-DISPUTE-0149-V1.0`：阴干羊刃／格局学派口径；
- `M20-DISPUTE-0150-V1.0`：季土燥湿权重口径。

这两项不得由默认值或多数规则自动改成通过。

## S6：校准和发布候选

工程机制已证明：

- 校准数据库与 Catalog 分域；
- 同意、带盐匿名哈希、预测冻结、现实反馈、独立二审和访问审计有自动化测试；
- 规则变更候选必须引用支持案例、反例、审阅者和候选快照；
- `npm run calibration:check -- --database=/absolute/path/calibration.sqlite` 只读检查 M4、M5 门槛；
- `npm run release:check -- --database=/absolute/path/calibration.sqlite` 是完整本地发布命令。

尚缺的权威外部证据：

- M4：至少 80 个批准案例、非空留出集、全部冻结、反馈完成、独立二审且安全漏判为 0；
- M5：至少 120 个批准案例、非空留出集、全部冻结、反馈完成、独立二审且安全漏判为 0；
- 两项学派争议的治理裁决；
- 当前提交的远端 CI 成功记录。

任何真实数据库都不得提交到 Git。发布操作者应在受控环境通过绝对路径提供数据库。

## 复现顺序

```bash
npm ci
npm run check
npm audit --audit-level=high
npm run test:evidence:current
npm run test:evidence
npm run calibration:check -- --database=/absolute/path/calibration.sqlite
npm run release:check -- --database=/absolute/path/calibration.sqlite
```

其中后三条严格门禁在治理或校准未完成时失败是正确行为，不得以 `--allow-review` 作为正式发布替代。
