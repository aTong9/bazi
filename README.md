# 八字关系分析系统

Node.js 22+ 的 TypeScript 模块化单体，提供 M0—M5 规则执行、关系分析、报告、安全门和可复现 Catalog Snapshot。

## 本地启动

```bash
npm ci
npm run check
npm run dev
```

服务默认监听 `http://127.0.0.1:3000`。验证：

```bash
curl http://127.0.0.1:3000/health
```

可使用 `BAZI_HOST` 和 `BAZI_PORT` 修改监听地址。`npm run dev` 会先构建当前规则快照；运行已构建快照时使用：

```bash
BAZI_SNAPSHOT_PATH=rulesets/<digest> npm start
```

## 常用命令

- `npm run check`：类型、测试、文档包、来源锁和 M0 映射验证；
- `npm run test:evidence`：执行严格的 407 项开发矩阵；
- `npm run release:check`：完整发布工程门禁；
- `npm run catalog:build`：生成只读规则快照；
- `npm run calibration:check -- --database=/path/to/calibration.sqlite`：可选的真实案例校准检查，不是发布前置条件。

开发规范、架构决策与完成度证据见 [docs/README.md](./docs/README.md)。
