# 八字关系分析系统

本仓库是一个本地优先的 M0—M5 八字关系分析工作台。后端使用 Node.js、TypeScript、SQLite 与确定性规则快照，前端使用 Vue 3 与 Vite；界面提供四柱手动录入、公历时间辅助排盘、单盘关系画像、具体关系现实评估、双盘结构补充、八道现实闸门、安全停止，以及规则快照/命中摘要和完整 JSON 导出入口。

完成分析后可使用“打印 / 存 PDF”生成适合 A4 阅读的看盘报告，也可使用“保存到档案”保存完整工作区，并从顶部“看盘档案”恢复、删除、导出备份或从备份导入。公历辅助产生的 UTC+8 出生时间、历法引擎版本和四柱对应关系会随档案保存，恢复后仍可追溯。档案最多保留 20 份，只写入当前浏览器的本地存储；导出文件未经加密，包含出生时间、四柱与现实证据，需要自行妥善保管。

在线版本：[https://atong9.github.io/bazi/](https://atong9.github.io/bazi/)。GitHub Pages 版在浏览器内执行同一套确定性分析引擎，出生资料和关系证据不会提交给本项目的 API；GitHub 仍会接收普通静态资源请求所包含的网络元数据。

## 本地运行

环境要求：Node.js `22.13` 至 `25.x`，npm `10+`。Node 22 必须至少为 22.13，确保 `node:sqlite` 可直接加载；首次启动会编译规则快照，耗时会比后续启动稍长。

```bash
npm ci
npm run dev
```

启动成功后打开：

- 界面：<http://127.0.0.1:5173>
- API 健康检查：<http://127.0.0.1:3000/health>

`npm run dev` 会同时启动 API 和 Vite。浏览器请求 `/health`、`/v1/*` 会由 Vite 代理到本地 API，因此开发环境不需要配置 CORS。

如果只开发单侧，可以分别运行：

```bash
npm run dev:api
npm run dev:web
```

## 本地生产预览

以下命令会构建前端、生成当前规则快照，再由 API 在同一端口托管界面和接口：

```bash
npm run preview
```

打开 <http://127.0.0.1:3000>。该路径用于手动验证生产环境实际使用的 SPA fallback、静态资源缓存、安全响应头和同源 API。`dev` 与 `preview` 默认都占用 API 的 `3000` 端口，切换前先停止正在运行的命令。

部署已有固定快照时使用：

```bash
npm run build
npm run catalog:build
BAZI_SNAPSHOT_PATH=rulesets/<digest> npm start
```

`npm start` 默认从 `apps/web/dist` 提供前端。可用以下环境变量覆盖运行参数：

- `BAZI_HOST`：监听地址，默认 `127.0.0.1`；
- `BAZI_PORT`：监听端口，默认 `3000`；
- `BAZI_SNAPSHOT_PATH`：生产运行时规则快照，`npm start` 必填；
- `BAZI_WEB_ROOT`：前端构建目录，默认 `apps/web/dist`。

## GitHub Pages 构建

```bash
npm run check:pages
```

该命令生成浏览器专用的完整运行目录 `apps/web/dist`：包含 10,918 条运行记录、`/bazi/` 基础路径、SPA 的 `404.html` fallback、PWA 清单、内容版本化的离线缓存和 `.nojekyll`。首次成功加载并显示“离线可用”后，界面与同版本规则包可在断网时继续运行；新版本在旧页面关闭后原子接管。`master` 更新后，[部署工作流](./.github/workflows/deploy-pages.yml)会发布该目录。Pages 没有 Node API、自定义服务端安全响应头或服务端持久化；需要验证 API 托管契约时仍应使用 `npm run preview`。

## 验证与测试

```bash
npm run check
npm run test:evidence
npm run release:check
```

- `npm run check`：后端与前端类型检查、全部自动化测试、Web 构建、文档包、来源锁和 M0 映射验证；
- `npm run test:evidence`：执行严格的 407 项开发矩阵并生成证据；
- `npm run release:check`：完整工程发布门禁与依赖审计；
- `npm run test:core` / `npm run test:web`：只运行后端或前端测试；
- `npm run typecheck:core` / `npm run typecheck:web`：只检查对应工程。

截至 2026-08-30，通用测试 runner 共执行 122 个测试用例（Node 核心 81、Web 41）；另有 5 个 Pages 产物/等价性专项测试和 407 项权威开发矩阵。各组口径不同，不合并成一个测试总数。桌面、手机和生产同源路径的浏览器验收记录见 [用户界面与本地开发说明](./docs/development/UI-and-local-development.md)。

## 当前产品边界

- 输入最终仍以复核后的年、月、日、时四柱为准。界面可把用户已经换算好的固定 UTC+8 公历时间辅助填入四柱，但交节、时辰交界和 23 时会停止自动选盘。
- 公历辅助不处理出生地时区、历史夏令时、农历生日或真太阳时，也不代表结果已获独立权威历法校验。
- 对外显示“中国标准时间（UTC+8）”，请求内部固定使用 IANA 时区 `Asia/Shanghai`。
- “另一方命盘”只提供结构辅助，不等于双盘现实适配评分，也不替代现实行为证据。
- M4 风险只作为待核验候选；`unknown`、`not_assessed`、`conditional` 和 `candidate` 不会被折叠成确定结论。
- RG01/RG07 的安全事实可触发安全停止；安全停止后界面只显示安全边界，不发布普通适配叙事。
- 系统不输出唯一正缘、成功概率、必然结局、动态岁运或具体关系日期。

## 工程入口

```text
apps/api/                       HTTP API、生产静态托管
apps/web/                       Vue 3 用户界面
apps/catalog-cli/               文档与规则快照命令
packages/application/           M0—M5 用例编排
packages/relationship-engine/   M1—M5 关系模块
packages/reporting/             安全裁决后的报告投影
tests/                          后端、契约与回归测试
docs/                           详细开发规范和原始整合资料
```

详细架构、字段权威、停止降级与测试策略见 [开发文档](./docs/八字关系分析系统_详细开发文档_V1.0.md)，文档索引见 [docs/README.md](./docs/README.md)。
