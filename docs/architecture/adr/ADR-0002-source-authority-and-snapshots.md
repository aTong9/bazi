# ADR-0002：三级权威与不可变规则快照

状态：Accepted

日期：2026-08-29

## Context

M0标准化CSV不能无损表达原生工作簿的专用列；M1—M5合并表与各模块CSV用途不同；Integration V1.0还存在M21漏注册和依赖拼写问题。运行时必须可复现，同时保持原始161文件包的SHA不变。

## Decision

区分三类权威：

1. 语义编写真源：M0 V1.9工作簿和M1—M5最新原子CSV；
2. 集成契约：系统版本清单和02_运行时核心六个文件；
3. 编译生成物：由显式source-package.lock和版本化overlay生成的只读Catalog Snapshot。

Integration V1.0保持字节级只读。修正通过带目标SHA的overlay完成，并进入ruleset digest；稳定后发布新的Integration版本。

## Consequences

- 构建工具不遍历docs寻找文件；
- 运行时不读取CSV或XLSX；
- 任何零匹配、多匹配、哈希漂移或语义冲突都阻止构建；
- 每个请求固定一个ruleset digest；
- loaded记录数与compiled规则数分开报告。
