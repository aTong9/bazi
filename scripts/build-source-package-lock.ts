import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

const packageRoot = "docs/八字关系分析系统_M0-M5开发整合包_V1.0";

const integrationCore = [
  ["02_运行时核心/M0_标准化记录_V1.0.csv", 1745],
  ["02_运行时核心/M1-M5_原子规则总表_V1.0.csv", 9373],
  ["02_运行时核心/统一模块注册表_V1.0.csv", 50],
  ["02_运行时核心/M0_术语编码_V1.0.csv", 621],
  ["02_运行时核心/M0_M19输出字段_V1.0.csv", 45],
  ["02_运行时核心/八字关系分析系统_M0-M5统一JSON_Schema_V1.0.json", null],
] as const;

const m0SemanticSources = [
  [
    "00_开发入口/M0_原始开发起步包/01_核心规则库/M0_八字结构判定与用神规则库_V1.9_版本与争议治理闭环版.xlsx",
    1745,
  ],
] as const;

const m1M5SemanticSources = [
  "05_原始来源_只读/M1-M5/M1/当前权威与参考/M1_CORE_核心规则原子表_V0.2.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_CORE_夫妻星准入规则原子表_V0.3.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_DUAL_双重门槛与正偏并见原子规则表_V0.6.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_FLOW_确认路径原子规则表_V0.5.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_GATE_夫妻宫门槛原子表_V0.2.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_SELF_自我选择位置原子规则表_V0.4.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_SYNTH_总合成规则原子表_V0.8.csv",
  "05_原始来源_只读/M1-M5/M2/当前权威与参考/M2_TEMPO_确认与进入节奏原子规则表_V0.7.csv",
  "05_原始来源_只读/M1-M5/M3/当前权威与参考/M3_BASE_关系运行底盘原子规则表_V0.2.csv",
  "05_原始来源_只读/M1-M5/M3/当前权威与参考/M3_BOUND_亲密距离依赖与边界原子规则表_V0.5.csv",
  "05_原始来源_只读/M1-M5/M3/当前权威与参考/M3_CARE_付出照顾与支持交换原子规则表_V0.4.csv",
  "05_原始来源_只读/M1-M5/M3/当前权威与参考/M3_CONFLICT_分歧响应与冲突处理原子规则表_V0.6.csv",
  "05_原始来源_只读/M1-M5/M3/当前权威与参考/M3_EXPR_情感表达与沟通原子规则表_V0.3.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_BASE_失衡候选底盘原子规则表_V0.2.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_BUFFER_调节保护与病药接口原子规则表_V0.8.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_LOOP_重复互动循环原子规则表_V0.6.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_MISREAD_关系识别与证据误读原子规则表_V0.3.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_OVERUSE_功能过用不足与竞争原子规则表_V0.4.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_REPAIR_修复卡点与回流断点原子规则表_V0.7.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_SYNTH_总合成规则原子表_V0.9.csv",
  "05_原始来源_只读/M1-M5/M4/当前权威与参考/M4_TRIGGER_触发条件阈值与状态切换原子规则表_V0.5.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_BASE_适配需求底盘与核心必要条件原子规则表_V0.2.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_BOUND_边界决定权资源与亲密空间原子规则表_V0.5.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_EXCHANGE_表达支持投入与双向交换原子规则表_V0.4.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_GAP_心动准入相处盲点与适配差异原子规则表_V0.8.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_PARTNER_伴侣功能画像与可观察行为原子规则表_V0.3.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_REPAIR_冲突顺序修复协议与状态协同原子规则表_V0.6.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_RHYTHM_推进节奏生活协同与关系气候原子规则表_V0.7.csv",
  "05_原始来源_只读/M1-M5/M5/当前权威与参考/M5_SYNTH_总合成规则原子表_V0.9.csv",
] as const;

const overlayPaths = [
  "data/overlays/integration-v1.0-patch-001.json",
] as const;

const lock = {
  lockVersion: "1.0",
  integrationVersion: "1.0",
  packageRoot,
  integrationCore: await Promise.all(
    integrationCore.map(([relativePath, expectedRecordCount]) =>
      fileEntry(
        path.posix.join(packageRoot, relativePath),
        "integration_core",
        "1.0",
        expectedRecordCount,
      ),
    ),
  ),
  semanticSources: {
    m0: await Promise.all(
      m0SemanticSources.map(([relativePath, expectedRecordCount]) =>
        fileEntry(
          path.posix.join(packageRoot, relativePath),
          "semantic_source",
          "1.9",
          expectedRecordCount,
        ),
      ),
    ),
    m1M5: await Promise.all(
      m1M5SemanticSources.map(async (relativePath) => {
        const repositoryPath = path.posix.join(packageRoot, relativePath);
        return fileEntry(
          repositoryPath,
          "semantic_source",
          versionFromFilename(relativePath),
          await csvRecordCount(repositoryPath),
        );
      }),
    ),
  },
  overlays: await Promise.all(
    overlayPaths.map((repositoryPath) =>
      fileEntry(repositoryPath, "overlay", "1.0", null),
    ),
  ),
  deniedPrefixes: ["06_历史归档/"],
};

await mkdir("data", { recursive: true });
await writeFile(
  "data/source-package.lock.json",
  `${JSON.stringify(lock, null, 2)}\n`,
  "utf8",
);

async function fileEntry(
  repositoryPath: string,
  role: "integration_core" | "semantic_source" | "overlay",
  modelVersion: string,
  expectedRecordCount: number | null,
) {
  return {
    path: repositoryPath,
    role,
    modelVersion,
    sha256: await sha256File(repositoryPath),
    ...(expectedRecordCount === null ? {} : { expectedRecordCount }),
  };
}

async function csvRecordCount(repositoryPath: string): Promise<number> {
  const records = parse(await readFile(repositoryPath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as unknown[];
  return records.length;
}

function versionFromFilename(filePath: string): string {
  const match = /_V([0-9]+(?:\.[0-9]+)*)\.csv$/u.exec(filePath);
  if (!match?.[1]) {
    throw new Error(`Cannot derive version from ${filePath}`);
  }
  return match[1];
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}
