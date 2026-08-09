# Golden fixture 说明

`wenzhen-boundary-cases.json` 同时承担两个用途：

1. 锁定本地排盘引擎在边界输入下的确定性输出。
2. 作为问真八字人工对照记录表。

当前 `expectedBaZi` 是本地引擎的 golden output；`wenzhenObserved` 为 `null` 的样本尚未在问真当前版本和明确设置下人工截图确认，因此不得标记为“问真一致”。

人工验证时必须记录：

- 问真应用版本。
- 公历或农历输入。
- 出生地点。
- 是否启用真太阳时。
- 早晚子时或换日设置。
- 起运算法设置。
- 问真输出四柱和起运信息。
- 截图文件或可审计引用。

只有完成上述记录后，才可填写 `wenzhenObserved` 并将 `verification` 改为 `verified`。

`wenzhen-public-api-golden.json` 是另一套可提交证据：它由问真网页所用的
公开接口在 2026-08-09 对 150 个合成输入采集，并通过
`scripts/promote-wenzhen-fixture.mjs` 从本地审核文件去除原始响应、审核人和
本地证据路径后生成。CI 会重算四柱、大运和起运并验证 30/30 常规盘兼容、
所有边界差异都有说明。它证明站点兼容性，不等同于权威历法认证。

`hko-lunar-conversion-golden.json` 从香港天文台 2023、2024 年官方公历与
农历日期对照表摘录 12 个常规月首和一组普通/闰二月月首。该 fixture 只验证
农历输入转换，不把天文台按日发布的节气日期扩张为精确交节时刻证据。
