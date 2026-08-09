# 八字情感分析网站

当前版本包含确定性排盘核心、交互式网页、结构化情感报告、流年与干支作用关系 API，以及隔离的小红书草稿引擎。可选的 OpenAI 服务端适配器只允许抽取、重排既有结论，并在返回前重新执行本地证据与安全校验。

完整规划见 [`roadmap.md`](./roadmap.md)。

## 当前能力

- 公历出生时间输入。
- 农历出生时间和闰月输入，并转换为可追溯的公历时间。
- IANA 历史时区与夏令时识别。
- 地点文本解析接口、Nominatim 适配器和坐标到 IANA 时区推导。
- 民用时间、地方平太阳时、真太阳时三种时间口径。
- 立春换年、十二节换月。
- 23:00 换日和 00:00 换日两种口径。
- 四柱、藏干、十神和纳音基础输出。
- 大运顺逆、起运时间、前八步大运、运干十神及每步大运与原局的作用关系。
- 完整时间修正与排盘计算轨迹。
- 立春、换月、时辰、子时、农历闰月和大运测试。
- 150 条问真公开接口兼容观测及可离线重放的脱敏 golden fixture：30 条常规样本全部匹配，120 条边界样本差异均有分类说明。
- 原局天干生克合冲、地支合冲刑害破、三合与三会。
- 流年干支、十神及其与原局的作用关系。
- 可交互网页与首个可调用的 HTTP API。
- 报告章节支持“符合 / 不符合 / 无法判断”反馈，并可导出不含出生时间、地点和四柱的匿名反馈 JSON；反馈不会自动修改规则。
- 小红书内容数据可按点击、互动、收藏分享、涨粉和观看时长生成版本化选题评分；运行 `npm run content:rank` 查看当前工作簿快照排名。

## 安装与验证

```bash
npm install
npm run check
npm test
npm run build
```

网页与接口：

```bash
cd web
npm install
npm run dev
```

`GET /api/chart` 返回能力信息；`POST /api/chart` 接收 `birth`、可选
`config` 和 `annual` 年份范围，返回命盘、原局关系、大运和流年。
`GET /api/places?q=上海` 提供地点解析。响应中的关系口径版本为
`mainstream-ganzhi-v1`。

可选 AI 文案接口默认关闭。设置服务端环境变量（不要使用 `NEXT_PUBLIC_`
前缀）后，`GET /api/narrative` 返回启用状态，`POST /api/narrative` 接收与
排盘接口相同的 `birth`、`config`：

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-5.6-luna npm run dev
```

外部请求设置 `store: false`，只包含服务端重新计算后的章节、结论、规则 ID
与八字文本，不包含原始出生时间和地点。模型输出若改变证据、增加新论断或触发
禁用表述，会以 `AI_OUTPUT_REJECTED` 拒绝，确定性 `/api/chart` 不受影响。

## 人工验收

问真兼容、规则批准和匿名案例基准不能由代码自行伪造。运行审核向导：

```bash
./scripts/review-wizard.sh
```

向导支持中断后继续，审核文件和截图默认被 Git 忽略。单独查看完成度：

```bash
node scripts/review-cli.mjs validate
```

## 最小调用示例

```ts
import { createFourPillarsChart } from "./src/index.js";

const chart = createFourPillarsChart({
  calendarType: "gregorian",
  gender: "female",
  localDate: "1990-01-01",
  localTime: "12:30:00",
  timeZone: "Asia/Shanghai",
  latitude: 31.2304,
  longitude: 121.4737,
});

console.log(chart.baZi);
console.log(chart.trace);
```

## 当前限制

- 真太阳时均时差暂采用 NOAA 常用近似公式，后续需要与问真边界样本和更高精度天文算法对照。
- 公共 Nominatim 实例只适合低频服务端查询；生产环境需要缓存、限流，并可替换为自建或商业地理编码服务。
- `tz-lookup` 为压缩边界数据，时区边界附近必须人工确认。
- 问真 golden fixture 保存的是公开接口观测，不等同于问真官方认证或人工审核。
- `mainstream-ganzhi-v1` 覆盖主流显式关系；暗合、拱合及“合化是否成立”属于流派判断，暂不自动下结论。
- 情感规则引擎已覆盖 roadmap 的 16 个主题登记；17 条不依赖争议算法的草案规则可执行，其余规则保持 `review_required`，等待身强弱、喜忌、制化口径和人工审核。
- 公开名人案例只用于站内命盘回放；匿名真人事件标签和独立命理师盲评仍未建立。
- `lunar-typescript` 是当前历法适配器，不应在业务层直接调用；未来可通过 golden tests 替换或校验。
