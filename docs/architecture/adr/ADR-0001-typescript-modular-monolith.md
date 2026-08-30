# ADR-0001：TypeScript 模块化单体

状态：Accepted

日期：2026-08-29

## Context

M0—M5形成固定依赖DAG。一次分析必须固定同一规则快照，并统一执行字段权威、去重、安全停止、语义校验和报告发布。当前仓库尚无实现工程，首个交付目标是可重复的数据编译器和M02—M06垂直切片。

## Decision

采用Node.js 22兼容的TypeScript模块化单体和npm workspaces。

- 领域模块不依赖HTTP、SQLite、CSV、Excel或具体历法库；
- Catalog、规则IR、领域引擎、策略、应用编排和Adapter按package隔离；
- M0—M5通过显式发布接口读取上游结果；
- web只依赖外部契约；
- TypeScript启用strict、exactOptionalPropertyTypes和noUncheckedIndexedAccess；
- 依赖版本由package-lock.json固定。

## Consequences

- 字段权威、同一快照和安全停止可以在一个进程内原子完成；
- 测试通过深模块的公共interface验证行为；
- 以后只有在出现真实部署需求和至少两个Adapter时才增加远程seam；
- 迁移到独立部署时，领域模块不需要重写。

## Rejected alternatives

- M0—M5微服务：增加版本同步和分布式一致性成本，当前没有独立扩容收益；
- 运行时读取文档：不能保证性能、版本固定和可复现性；
- 通用自然语言规则解释器：无法稳定复现，也无法通过确定性回归。
