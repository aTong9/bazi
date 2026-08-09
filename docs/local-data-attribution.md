# 本地地点数据说明

网页中的中国行政区层级来自 `lcn@7.2.2`，运行时直接随前端打包。区县中心点由
`@pikaz/location@1.0.10`（MIT）所含 2022 行政区坐标离线提取，并按当前 `lcn`
行政区代码固化为 `web/app/data/china-district-coordinates.json`。

- 当前行政区：31 个省级节点、2849 个区县节点。
- 2828 个区县使用同代码区县中心点。
- 21 个后续更名或新设区县使用所属城市中心点，JSON 第三个字段标记为 `city`。
- 坐标仅用于出生地经度初值，不代表精确出生地址；界面允许用户手动校正。
- 运行时不会向 Nominatim、高德、百度或其他在线地理编码服务发请求。

上游软件许可：

- `lcn`: MIT，<https://www.npmjs.com/package/lcn>
- `@pikaz/location`: MIT，<https://www.npmjs.com/package/@pikaz/location>

若用于正式产品，应定期依据民政部行政区划变更更新层级，并复核所采用坐标数据的
来源、许可与精度。
