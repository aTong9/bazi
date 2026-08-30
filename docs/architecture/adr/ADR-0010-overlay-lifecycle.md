# ADR-0010：Integration V1.0 Overlay 生命周期与 V1.1 升级条件

状态：Accepted

日期：2026-08-29

## Context

Integration V1.0 的注册表和校准合同存在已确认缺口，但权威源文件必须保持不可变。需要一种可审计、可撤销且不会演变成永久分叉的修补机制。

## Decision

- Overlay 是版本化 JSON，必须声明 patch ID、目标路径、精确操作、依据和 `approved` 状态；
- 构建只应用 source-package lock 显式列出的 overlay，并在应用前验证目标与预期值；
- Overlay 不直接修改 `docs` 权威包，应用结果和 patch ID 写入快照 manifest 与 digest；
- 未批准、目标漂移、Schema 不符或操作冲突时构建失败；
- 当 V1.1 权威包原生包含同等修复、通过全矩阵且快照差异审查无意外变化时，移除对应 overlay；
- 移除通过新提交完成，不覆盖历史快照。

## Consequences

- 当前 V1.0 可在保留原始证据的同时可靠运行；
- 每个运行快照都能回答应用了哪些补丁；
- Overlay 数量和存续时间需受治理审查，不能承载未获批准的新业务规则。
