# 公历出生日期时间到四柱：CalendarPort 适配器调研

> 调研日期：2026-08-30
> 范围：只调查“用户提供公历出生日期与时间，系统按约定的北京时间口径生成四柱”所需的历法适配能力。本文不论证命理解释，也不授权直接开放生产入口。

## 1. 结论

推荐把 `lunar-typescript@1.8.6` 作为第一阶段 **CalendarPort 候选计算内核**，而不是把它直接暴露给 UI 或领域模型。理由是：它有明确的 `Solar.fromYmdHms(...).getLunar().getEightChar()` 路径；源码使用“精确”立春和节令时刻划分年、月柱；节气计算明确注释为北京时间；无运行时依赖并同时发布 ESM、CJS 和类型声明；MIT 许可；仓库和 npm 包近期仍有更新。[官方 README](https://github.com/6tail/lunar-typescript/blob/master/README_EN.md)、[npm 注册表元数据](https://registry.npmjs.org/lunar-typescript)、[package.json](https://github.com/6tail/lunar-typescript/blob/master/package.json)

但现有一手证据不足以支持“天文台级精度”“任意历史年份均可靠”“自动处理出生地时区”“支持真太阳时”或“交节时刻零误差”等宣传。首发应限制产品年份，固定计算口径，保留输入与计算来源，并在交节附近返回边界提示或双候选，不发布未经金样验证的唯一结论。

## 2. 候选库核查

### 2.1 `lunar-typescript`

| 项目 | 一手证据 | 判断 |
| --- | --- | --- |
| 维护状态 | 官方简介明确说 Lunar 后续不再增加新特性、仅修复 bug，并推荐长期支持的 Tyme；GitHub `master` 在 2026-08-13 仍有提交。npm `latest` 是 `1.8.6`，发布时间为 2025-11-05；当前 GitHub HEAD 与 npm 发布提交不同。[官方简介](https://6tail.cn/calendar/overview.html)、[当前 HEAD](https://github.com/6tail/lunar-typescript/commit/f086189a0b159cd5d71d1b23090ccf034444fa04)、[npm 1.8.6 发布提交](https://github.com/6tail/lunar-typescript/commit/0f3e95d)、[npm 元数据](https://registry.npmjs.org/lunar-typescript) | 属于维护期而非新特性开发期；可作为稳定兼容内核，但不能承诺 SLA。生产必须锁 npm 精确版本与完整性摘要，不能从浮动 GitHub HEAD 构建。 |
| 基础 API | README 展示 `Solar.fromYmd(...).getLunar()`；源码提供 `Solar.fromYmdHms`、`Solar.fromDate`，`Lunar.getEightChar()` 返回八字对象。[README](https://github.com/6tail/lunar-typescript/blob/master/README_EN.md)、[Solar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/Solar.ts)、[Lunar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/Lunar.ts)、[EightChar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/EightChar.ts) | 能覆盖公历字段到四柱的核心调用。生产适配器应调用 `fromYmdHms`，不要调用依赖宿主本地时区的 `fromDate`。 |
| 年、月柱交界 | `Lunar._computeYear` 分别按立春日期和精确到秒的立春时刻计算，`_computeMonth` 逐个比较节令的 `toYmdHms()`；`EightChar.getYear/getMonth` 取 exact 结果。[Lunar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/Lunar.ts)、[EightChar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/EightChar.ts) | 四柱入口应使用库的 exact getter，不能用公历月份或农历月名自行推月柱。 |
| 节气算法与显示精度 | `LunarYear.compute` 注释“节气时刻（北京时间）”，先经 `calcQi` 再用 `qiAccurate2` 生成儒略日；`ShouXingUtil` 用太阳黄经、ΔT 修正和 `1/3` 日（8 小时）偏移计算；测试断言节气时刻到秒，例如 2012 白露 `13:29:01`、2050 大雪 `06:41:54`。[LunarYear.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/LunarYear.ts)、[ShouXingUtil.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/ShouXingUtil.ts)、[JieQiTest.ts](https://github.com/6tail/lunar-typescript/blob/master/src/test/JieQiTest.ts) | 库会输出秒级值，但“输出到秒”不等于“经权威源验证后精确到一秒”。当前官方测试是维护者回归样例，不是精度声明。 |
| 时区处理 | `Solar.fromYmdHms` 只接收数字字段；对象内部也只保存年月日时分秒，没有时区或 offset。`Solar.fromDate` 调用 JS `Date` 的本地 `getFullYear/getHours` 等方法。官方 FAQ 也要求调用方明确日期对象时区。[Solar.ts L8-L28](https://github.com/6tail/lunar-typescript/blob/f086189a0b159cd5d71d1b23090ccf034444fa04/src/lib/Solar.ts#L8-L28)、[官方 FAQ](https://6tail.cn/calendar/faq.html) | 库不是时区转换器。传入字段按其算法约定直接参与北京时间历法计算；不能把带 offset 的时间字符串交给它并期待自动规范化。 |
| 北京标准时与真太阳时 | 节气源码明确采用北京时间偏移；官方 FAQ 明确答复“暂不支持”真太阳时，建议调用方转换后再传入。[LunarYear.ts L67-L79](https://github.com/6tail/lunar-typescript/blob/f086189a0b159cd5d71d1b23090ccf034444fa04/src/lib/LunarYear.ts#L67-L79)、[官方 FAQ](https://6tail.cn/calendar/faq.html) | 支持的是库定义的北京时间字段口径，不支持出生地真太阳时。真太阳时必须是未来独立、显式、可审计的政策，不能暗中校正。 |
| 年份范围 | 官方简介写“约公元 1 年至 9999 年”；官方测试覆盖公历 `0001-01-01` 与 `9999-12-31` 的农历转换，也覆盖 1500 年和格里历改革断档。[官方简介](https://6tail.cn/calendar/overview.html)、[LunarTest.ts L393-L410](https://github.com/6tail/lunar-typescript/blob/f086189a0b159cd5d71d1b23090ccf034444fa04/src/test/LunarTest.ts#L393-L410) | 可以记录上游声明范围，但不可称“1—9999 年四柱均经权威验证”。项目首发应自行收窄到有金样的现代年份。 |
| 浏览器兼容 | 包声明 ESM `dist/index.mjs`、CJS `dist/index.cjs` 和类型声明，且 `package.json` 没有 dependencies；核心源码 import 均为包内模块。[package.json](https://github.com/6tail/lunar-typescript/blob/master/package.json) | 适合 Vite 浏览器构建，但仍须以本项目 `build:pages`、真实浏览器和 bundle 检查为准，不能只凭元数据宣称支持所有浏览器。 |
| 许可证 | 仓库为 MIT，要求分发软件副本或主要部分时保留版权和许可声明，并声明软件按原样提供、无担保。[LICENSE](https://github.com/6tail/lunar-typescript/blob/master/LICENSE) | 可用于本项目；发布产物和第三方声明中保留 MIT 文本及版权信息。 |

### 2.2 `tyme4ts`

`tyme4ts` 是同一维护者称作 Lunar 升级版的新库，Lunar 官方简介把 Tyme 列为长期支持项目，Tyme README 明确说节气算法引自寿星天文历；其 npm 包同样发布 ESM/CJS/类型声明且为 MIT。[Lunar 官方简介](https://6tail.cn/calendar/overview.html)、[Tyme 官方仓库](https://github.com/6tail/tyme4ts)、[package.json](https://github.com/6tail/tyme4ts/blob/master/package.json)、[LICENSE](https://github.com/6tail/tyme4ts/blob/master/LICENSE)

它值得作为后续对照内核，但本阶段不建议直接替换首选候选：项目需要先冻结四柱具体 API、子初换日口径、交节输出和金样；“升级版”是维护者定位，不等于已证明与本项目规则契约更匹配。保守做法是让相同金样同时跑 `lunar-typescript` 与 `tyme4ts`，分歧全部进入人工审查，而不是多数表决。

## 3. 时间口径：必须分开的三件事

### 3.1 出生记录的民用时间

若用户填写的是某地钟表时间，应先由 CalendarPort 外围的时间规范化层把“本地日期时间 + IANA 时区”解析成唯一瞬间，再转换为选定的排盘口径。ECMA-402 要求时区感知实现使用 IANA 时区数据库；未显式提供 `timeZone` 时，`Intl.DateTimeFormat` 使用宿主环境时区，因此绝不能依赖默认值。[ECMA-402 §6.5](https://tc39.es/ecma402/#sec-use-of-the-iana-time-zone-database)、[ECMA-402 DateTimeFormat](https://tc39.es/ecma402/#datetimeformat-objects)

Node 官方二进制默认带 full ICU，但 Node 也支持 system-icu、small-icu 或无 Intl 的构建，功能会随 ICU 数据完整性变化；启动时必须做能力检测并记录 `process.versions.icu`。[Node.js Intl 文档](https://nodejs.org/api/intl.html)

### 3.2 北京时间字段

`lunar-typescript` 的节气算法以北京时间字段为基准，但它不解析 IANA 时区。若产品政策是“无论出生地，统一按中国标准时间 UTC+8 排盘”，适配器应将唯一瞬间转换成固定 `UTC+08:00` 字段后再调用 `Solar.fromYmdHms`。

不要把 `Asia/Shanghai` 与“永远固定 UTC+8”混为一谈。IANA 的 `Asia/Shanghai` 包含历史本地平太阳时、历史夏令时，以及中国 1986—1991 年夏令时规则；IANA 还明确指出早期中国时间记录存在不确定性。[IANA `asia` 数据](https://data.iana.org/time-zones/tzdb/asia)、[IANA 时区数据库说明](https://www.iana.org/time-zones/tz-link)

因此输入契约至少需要显式区分：

- `recorded_local_time`：出生证明/家人记忆中的钟表时间；
- `recorded_time_zone`：该钟表时间所属 IANA zone，未知则标记未知；
- `calculation_standard`：首发固定为 `china_standard_time_utc_plus_08`；
- `calculation_civil_fields`：真正传给历法内核的 UTC+8 年月日时分秒；
- `tzdb_version`、`calendar_engine`、`calendar_engine_version` 与构建摘要。

对 1986—1991 年中国夏令时、1970 年前的中国地点或无法确定采用何种钟表时间的记录，不能静默猜测。应停止唯一四柱发布，要求用户确认记录口径或输出候选集合。

### 3.3 真太阳时

真太阳时需要地点经度、地方平太阳时与均时差等另一套政策。`lunar-typescript` 没有经纬度输入，也没有证明执行了真太阳时修正。因此首发 UI 必须写清“按中国标准时间 UTC+8，不做真太阳时修正”；没有准确地点时尤其不得暗示已做地理校正。

## 4. 推荐的保守集成策略

### 4.1 适配器边界

在现有 `CalendarPort` 后新增一个适配器，而不是让 Web 组件直接 import 历法库。建议最小契约：

```ts
type CalendarInput = {
  localDateTime: string;          // ISO-like wall fields, 不允许隐式宿主时区
  recordedTimeZone: string | null;
  calculationStandard: "china_standard_time_utc_plus_08";
  precision: "exact" | "approximate" | "date_only";
};

type CalendarResult = {
  normalizedInstant: string | null;
  calculationCivilTime: string;
  pillars: { year: string; month: string; day: string; hour: string | null };
  previousJie: { name: string; at: string; distanceSeconds: number };
  nextJie: { name: string; at: string; distanceSeconds: number };
  boundaryStatus: "clear" | "review" | "ambiguous";
  candidates: Array<{ civilTime: string; pillars: unknown }>;
  provenance: { engine: string; version: string; tzdb: string; policy: string };
};
```

### 4.2 调用顺序

1. 严格验证公历字段，拒绝不存在的日期、秒外溢和隐式浏览器时区。
2. 若是出生地钟表时间，用显式 IANA zone 解析；遇到 DST 重复或跳过的本地时间，返回歧义而非自动选早/选晚。
3. 转换成固定 UTC+8 民用字段；若用户明确说输入本身就是北京时间，可直接保留字段，但记录该声明。
4. 调用 `Solar.fromYmdHms(y, m, d, h, min, sec).getLunar().getEightChar()`，读取 exact 年、月柱；日柱的子初换日 sect 必须另立政策并锁定。
5. 同时读取前一/后一“节”（不是泛指所有中气）的准确时刻，并计算输入到边界的秒数。
6. 把输入、规范化结果、引擎版本、节气边界、最终四柱一起保存为不可变 `NatalChartSnapshot`。

### 4.3 交节边界检测

上游提供 `getPrevJie()`、`getNextJie()`、`getJieQiTable()` 和精确到秒的 `Solar` 值；边界检测应基于“计算用北京时间”与相邻节令时刻的差，而不是只看是否同一天。[JieQiTest.ts](https://github.com/6tail/lunar-typescript/blob/master/src/test/JieQiTest.ts)、[Lunar.ts](https://github.com/6tail/lunar-typescript/blob/master/src/lib/Lunar.ts)

建议策略：

- `distance <= inputUncertainty`：`ambiguous`，分别对不确定区间两端计算，若四柱不同则返回双候选；
- `inputUncertainty < distance <= reviewWindow`：`review`，允许展示结果但必须提示接近交节；
- 其他：`clear`。

`inputUncertainty` 来自资料本身：精确到分钟至少按 ±60 秒，大概时刻应按用户给出的区间，只有日期则不生成唯一时柱。`reviewWindow` 不应伪装成天文学误差；在没有权威金样统计前可将其设为可配置安全窗（例如 2 小时），但该数值属于产品保守政策，不能宣称是库的精度。

还应加入一项实现级探针：对交节时刻前后各一秒分别计算，确认预期的年柱或月柱只在边界处翻转；若不翻转或两个候选出现非预期差异，CalendarPort fail closed。

### 4.4 首发范围和验收门槛

建议首发只开放本项目建立了权威金样的现代年份，例如先以 `1901—2099` 为候选产品范围；这只是风险控制建议，最终范围必须由金样覆盖决定，不是上游库保证。每个支持年份至少覆盖：

- 立春前一秒、边界、后一秒；
- 12 个“节”的前一秒、边界、后一秒；
- 23:00、00:00 与采用的子初换日两种 sect；
- 中国 1986—1991 夏令时转换附近的钟表输入；
- 闰年、月末、格里历合法性；
- UTC+8 字段与 `Asia/Shanghai` 历史 offset 可能不同的样本；
- `lunar-typescript`、对照实现和独立权威节气表的差异报告。

没有覆盖的年份应拒绝自动排盘，而不是降级为无提示结果。

## 5. 明确不可宣称的能力

在完成独立金样、ADR 与误差预算前，产品、README 和 UI 不得宣称：

- “四柱绝对准确”“专业命理师级零误差”；
- “节气精确到秒”——只能说库输出秒字段；
- “支持公元 1—9999 年准确排盘”——只能说上游测试覆盖端点转换；
- “自动识别全球出生时区”或“自动处理所有历史时区”；
- “`Asia/Shanghai` 就是所有年代的固定 UTC+8”；
- “已按出生地真太阳时校正”；
- “交节附近一定只有一个正确命盘”；
- “浏览器和 Node 在任意 ICU/tzdb 版本下结果永远一致”；
- “`lunar-typescript` 的上游测试等同于本项目的独立权威验证”；
- “历法换算结果证明情感结论真实或决定关系选择”。

## 6. 集成前必须冻结的决策

1. 日期输入表示出生地钟表时间，还是用户已经换算好的北京时间。
2. 排盘统一使用固定 UTC+8，还是遵循出生地历史民用时区后再转换；两者的展示文案必须不同。
3. 23:00 子初换日采用 `EightChar` sect 1 还是 sect 2。
4. 缺时刻、时刻大概、时区未知和 DST 重复/缺失时刻分别如何生成候选。
5. 交节 review 窗口和资料不确定区间如何合并。
6. 产品年份范围、权威金样来源、容许误差和分歧处理。
7. 是否永远禁用真太阳时，或未来以独立可选政策提供；不得默认开启。
8. 前端 bundle 中的库版本/许可披露，以及 snapshot 中的引擎与 tzdb 溯源字段。

## 7. 推荐下一步

先做一个不接 UI 的 CalendarPort 垂直切片：锁定 `lunar-typescript@1.8.6`，实现固定 UTC+8 字段输入、四柱结果、相邻节令距离、双候选与 provenance；再建立交节和子初换日金样。只有这些门槛通过并修订 `ADR-0007` 后，才启用公历生日输入。`tyme4ts` 作为差异检测对照，不作为“谁新就信谁”的自动裁决器。
