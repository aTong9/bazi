# ADR-0003：确定性 Catalog Snapshot 与只读 SQLite

状态：Accepted

日期：2026-08-29

## Context

S1 必须精确接收 1,745 条 M0 和 9,373 条 M1—M5 记录，同时保证请求期间不读取 `docs`、不静默丢弃记录，并让同一输入得到相同 ruleset digest。当前阶段尚未实现各模块执行器，不能把“已装载”冒充“已编译”。

## Decision

- 构建只读取显式 `source-package.lock.json` 所列来源，并先执行哈希、overlay 和 M0 工作簿富化校验；
- 每条记录必须落入 `compiled`、`reference_only`、`guardrail`、`test_only`、`governance` 或 `unsupported_with_reason`；
- S1 仅将 45 条 M19 输出契约标记为 `compiled`，尚未实现的 10,833 条执行规则明确标记为 `unsupported_with_reason`；后续阶段按模块替换为类型化 IR；
- 10,918 条运行时可用记录写入 `runtime.sqlite`，M20 fixture 和 M21 治理记录写入独立 JSONL；
- digest 包含来源锁、迁移映射、语义策略、字段权威、Schema 集合和编译器版本，不包含构建时间；
- 先在临时目录构建，关闭并只读重开自检成功后原子发布；失败时删除半成品；
- 首版通过 Catalog Adapter 使用 Node.js 22 的 `node:sqlite`，不让该 API 泄漏到领域层。

## Consequences

- `loadedRecordCount`、`compiledRecordCount` 和逐模块 coverage 必须分别报告；
- 相同输入可重复得到相同目录名和 manifest；
- 运行时只能打开 digest 目录内的只读 SQLite；
- Node.js 当前会显示 SQLite 实验性提示，但该实现被限制在单一 Adapter 内，未来可替换而不改变领域接口。
