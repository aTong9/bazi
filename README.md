# 八字情感分析网站

[![Deploy GitHub Pages](https://github.com/aTong9/bazi/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/aTong9/bazi/actions/workflows/deploy-pages.yml)

当前版本包含确定性排盘核心、纯本地交互式网页、结构化情感报告、流年与干支作用关系，以及隔离的小红书草稿引擎。网页不依赖 HTTP API：排盘、地点搜索和文案组合都在浏览器完成。

完整规划见 [`roadmap.md`](./roadmap.md)。

## 当前能力

- 公历出生时间输入。
- 农历出生时间和闰月输入，并转换为可追溯的公历时间。
- IANA 历史时区与夏令时识别。
- 全国省、市、区县三级本地数据，内置 2849 个区县坐标并允许手动校正。
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
- 可交互、可静态导出的纯本地网页。
- 本地 JSON 文案模板按报告证据组合文章，不需要模型密钥，也不上传出生资料。
- 报告章节支持“符合 / 不符合 / 无法判断”反馈，并可导出不含出生时间、地点和四柱的匿名反馈 JSON；反馈不会自动修改规则。
- 小红书内容数据可按点击、互动、收藏分享、涨粉和观看时长生成版本化选题评分；运行 `npm run content:rank` 查看当前工作簿快照排名。

## 安装与验证

```bash
npm install
npm run check
npm test
npm run build
```

网页：

```bash
cd web
npm install
npm run dev
```

浏览器打开终端输出的本地地址即可。若要验证可独立托管的静态产物：

```bash
npm run build
npm run start
```

生产构建是静态导出，位于 `web/dist/client`。它不需要 Node 服务进程；任意静态
文件服务器都能托管。文案配置位于 `web/app/data/narrative-templates.json`，
生成结果同时保留命中规则 ID。真正的大模型自由改写不可能只靠 JSON 完成，当前
版本明确采用“审核模板 + 确定性组合”，以换取离线、隐私与可回归测试。

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
- 国内区县坐标来自随项目固化的行政区中心点，出生地点接近区县边界或需要更高真太阳时精度时，应手动校正经纬度。
- 海外离线地点目前只内置常用城市；未收录地点需手动填写经纬度与 IANA 时区。
- `tz-lookup` 为压缩边界数据，时区边界附近必须人工确认。
- 问真 golden fixture 保存的是公开接口观测，不等同于问真官方认证或人工审核。
- `mainstream-ganzhi-v1` 覆盖主流显式关系；暗合、拱合及“合化是否成立”属于流派判断，暂不自动下结论。
- 情感规则引擎已覆盖 roadmap 的 16 个主题登记；17 条不依赖争议算法的草案规则可执行，其余规则保持 `review_required`，等待身强弱、喜忌、制化口径和人工审核。
- 公开名人案例只用于站内命盘回放；匿名真人事件标签和独立命理师盲评仍未建立。
- `lunar-typescript` 是当前历法适配器，不应在业务层直接调用；未来可通过 golden tests 替换或校验。

## GitHub Pages 部署

仓库包含 `.github/workflows/deploy-pages.yml`，推送到 `master` 或手动运行
workflow 时会检查、测试、静态构建并部署 `web/dist/client`。不需要服务器、
API 地址或密钥。在 **Settings → Pages → Build and deployment → Source** 选择
**GitHub Actions**。项目站点会自动使用仓库名作为路径前缀，例如本仓库为
`/bazi`；`<owner>.github.io` 用户站点则使用根路径。

Pages 必须由仓库管理员进行上述一次性启用。未启用时 GitHub 的
`configure-pages` 会返回 404；这是仓库设置问题，不是项目构建失败。启用后，
每次推送 `master` 都会自动取消旧的在途部署，并发布最新版本。
