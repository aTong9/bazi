# 用户界面与本地开发说明

状态：已实现；自动化与浏览器验收均已记录
适用范围：`apps/web`、`apps/api` 静态托管、本地开发与生产预览
更新时间：2026-08-30

## 1. 产品界面定位

前端名称为“关系脉络 · M0—M5 证据工作台”。它不是通用仪表盘，也不是自动排盘工具，而是把已经排好的四柱、关系结构候选、现实证据和安全边界组织成一条可阅读、可追踪的分析链。

核心流程：

```text
四柱输入
  → M0 原局结构
  → M1 吸引入口
  → M2 选择机制
  → M3 相处惯性与修复
  → M4 风险候选
  → M5 现实闸门、证据等级与边界
```

视觉上使用“关系脉络轨道”作为 M0—M5 的统一导航。界面以墨色、矿物青和纸白为主，输入区与结果区通过结构和线性层级区分，避免把所有信息压成同权重卡片。

## 2. 两种分析模式

两种模式都只接受已经排好的四柱，都可以选择传统夫妻星计算口径，并可选录入另一方命盘。另一方命盘在任一模式都只进入 `structuralSupplement`；它补充双方结构背景，不生成现实适配分数，也不替代现实行为、同意、安全事实或现实闸门。

### 2.1 关系画像

调用 `POST /v1/relationship/profile`，以一张主要命盘生成关系结构画像；可选的另一方命盘仍只作结构补充。请求固定包含：

- `analysis_mode: "production"`；
- 一份经过五虎遁、五鼠遁联动校验的四柱；
- IANA 时区 `Asia/Shanghai`；
- 明确的传统夫妻星计算口径，或 `unspecified`；
- `m0` 至 `m5` 全部请求节。

该模式的 M5 上限为 FG1。八道现实闸门显示为 `not_assessed`，不得解释为失败。

### 2.2 现实评估

调用 `POST /v1/relationship/evaluate`。除主要命盘外，界面允许录入：

- RG01—RG08 的 `pass`、`conditional`、`fail`、`unknown` 或 `not_assessed`；
- 每道闸门的一句可观察事实；
- 日常、压力、修复后、转折期和反例复核五种跨情境状态；
- M4 风险候选的两份独立来源/情境观察。

另一方命盘的共通契约必须同时保持：

```text
scope = structural_auxiliary_only
replacesRealityEvidence = false
replacesRealityGates = false
```

## 3. 安全和状态呈现

前端在 HTTP 200 后仍执行运行时响应校验。以下状态不能只靠颜色区分，并且不能互相折叠：

- `unknown`：事实未知；
- `not_assessed`：尚未评估；
- `candidate`：结构候选；
- `conditional`：条件性成立；
- `contradicted`：存在反证；
- `dependency_pending`：上游计算口径或资料尚缺；
- `stopped`：停止发布该项。

当 `report.safetyStatus === "safety_stop"` 时，界面必须只渲染安全章节和硬边界。M0—M5 普通模块轨道、普通报告、风险候选和适配结论全部隐藏。运行时 guard 同时要求：

```text
reportStatus = stop
evidenceGrade = FG0
assessment = AF09
sections 只能包含 safety
```

这项限制同时存在于领域规则、报告投影、API 测试、前端响应 guard 和组件测试中。

## 4. 前端工程

```text
apps/web/
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── src/
    ├── App.vue
    ├── api.ts
    ├── constants.ts
    ├── domain.ts
    ├── types.ts
    ├── styles.css
    └── components/
        ├── PillarEditor.vue
        ├── RealityGatePanel.vue
        ├── ObservationPanel.vue
        ├── ModuleRail.vue
        └── AnalysisResult.vue
```

职责边界：

- `domain.ts`：60 甲子、五虎遁月柱约束、五鼠遁时柱约束和 wire subject 投影；
- `api.ts`：网络请求、统一错误对象和成功响应运行时 guard；
- `PillarEditor.vue`：四柱联动、时辰未知/大致状态和资料质量；
- `RealityGatePanel.vue`：现实闸门与跨情境核验；
- `ObservationPanel.vue`：首次分析后，按 M4 chain ID 录入两份独立现实观察；
- `AnalysisResult.vue`：安全优先的报告投影和 M0—M5 详细依据；
- `styles.css`：桌面、平板、390px 手机、键盘焦点和 reduced-motion 行为。

浏览器工程不得直接导入需要 `node:fs`、SQLite 或 Ajv 文件加载的后端契约代码。它通过 browser-safe DTO 和运行时 guard 验证实际响应。

## 5. 本地开发拓扑

运行时版本与根 `package.json` 一致：Node.js `>=22.12 <26`。当前锁文件和 CI 使用 npm workspace；本地推荐 npm `10+`。

```text
浏览器 http://127.0.0.1:5173
  ├── Vite 提供 Vue 资源和 HMR
  └── /health、/v1/* 代理到 127.0.0.1:3000
                              └── API 打开当前只读 Catalog Snapshot
```

启动：

```bash
npm ci
npm run dev
```

`npm run dev` 使用 `concurrently` 启动 `dev:api` 和 `dev:web`；任一侧异常退出会终止另一侧，避免留下看似可用但已失去 API 的前端。

## 6. 生产同源托管

```text
浏览器 http://127.0.0.1:3000
  └── node:http
      ├── /health、/v1/* → API
      ├── /assets/*      → Vite 指纹资源，immutable cache
      └── 其他 HTML GET  → index.html SPA fallback，no-cache
```

本地验证：

```bash
npm run preview
```

静态服务约束：

- API 路由优先，不得被 SPA fallback 掩盖；
- 只接受 GET 和 HEAD；
- fallback 只用于明确接受 HTML 的非 API 请求；
- `realpath` 校验阻止 `..`、编码路径穿越和符号链接越界；
- 缺少 Web 根目录或 `index.html` 时启动即失败；
- HTML 使用 `no-cache`，Vite 指纹资源使用一年 immutable cache；
- 响应设置 CSP、`nosniff`、frame deny 和 referrer policy；
- 生产构建不生成 source map。

## 7. 测试与验收

截至 2026-08-30：

- `npm run test:core`：73 个 Node runner 用例通过；
- `npm run test:web`：4 个前端测试文件、19 个 Vitest 用例通过；
- `npm run test:evidence`：407 项权威矩阵全部通过；
- `npm run typecheck`、`npm run build:web` 和静态 Web 集成测试通过。

92 个通用 runner 用例与 407 项权威矩阵是两套不同口径：前者验证代码和组件行为，后者绑定原始测试矩阵 ID，不能相加为一个测试总数。

前端自动化至少覆盖：

- 60 甲子生成和合法解析；
- 年干变化后月柱干支联动；
- 日干变化后时柱干支联动；
- 时辰未知时 wire payload 的 `hour = null`；
- 健康检查和分析响应 guard；
- 不合法成功响应转为 `E_RESPONSE_SCHEMA`；
- safety stop 只显示安全内容；
- M0—M5 轨道状态映射。
- 空的 M4 观察不发送，已填写观察保留 chain ID、来源、情境和正反方向。

后端集成至少覆盖：

- Web 根路径和 HTML 深链接；
- JS/CSS MIME、HEAD 与缓存；
- `/v1/unknown` 保持 JSON 404；
- 路径穿越和符号链接越界；
- 缺失构建目录 fail-fast；
- `timezone` 必填；
- `approximate` 时辰返回 `limited + HOUR_APPROXIMATE`。

提交前运行：

```bash
npm run typecheck
npm test
npm run build:web
npm run check
```

### 7.1 2026-08-30 真实浏览器验收

开发路径在 `1280 × 720` 与 `390 × 844` 两个视口完成验收，生产同源路径另行验证。已覆盖：

- 初始页、关系画像与现实评估模式切换；
- 有效单盘、未知时辰、大致时辰和未指定传统角色口径；
- 两种模式下的可选另一方命盘及“只作结构辅助”边界；
- 首次分析后出现 M4 风险链，两份独立现实观察可录入并随再次评估发送；
- RG01 安全失败后只显示 safety 章节，普通 M0—M5 轨道和适配叙事隐藏；
- API 离线状态、错误提示与服务恢复后的重新连接；
- 键盘焦点、跳转链接、窄屏无横向溢出和 reduced-motion 路径；
- 生产深链接 SPA fallback；`/v1/*` 继续返回 JSON，JS/CSS MIME、HEAD、HTML `no-cache`、指纹资源 immutable cache、CSP、`nosniff`、frame deny 与 referrer policy 符合静态托管契约。

本轮浏览器证据不包含“下载完整 JSON”按钮触发后的文件落盘事件，因此下载事件不计入已验收项。

## 8. 明确不在当前 UI 内的能力

- 公历或农历生日到四柱的自动排盘；
- 真太阳时、地点和节气边界换算；
- D0 动态岁运和具体事件时点；
- 把 FG 当作成功概率；
- 把另一方命盘当作现实适配或安全证据；
- 真实案例校准录入和治理审批后台。

当前 API 与界面也不会自动持久化出生资料、关系事实或分析结果；页面只展示本次响应，持久保存需要用户主动导出或未来另建应用数据域。

这些能力需要独立契约、数据来源和安全审查，不应通过前端猜测或隐式默认值补齐。
