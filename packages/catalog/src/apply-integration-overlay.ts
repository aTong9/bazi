import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "csv-parse/sync";

type ModuleRecord = Record<string, string>;

interface AddModuleOperation {
  operationId: string;
  op: "add_module";
  targetPath: string;
  targetSha256: string;
  key: string;
  value: ModuleRecord;
}

interface ReplaceTokenOperation {
  operationId: string;
  op: "replace_token";
  targetPath: string;
  targetSha256: string;
  key: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface CalibrationContract {
  targetPath: string;
  authoritativeWorkbookPath: string;
  sheet: string;
  range: string;
  legacyAction: "reject";
  expectedHeaders: string[];
}

interface CalibrationOperation extends CalibrationContract {
  operationId: string;
  op: "declare_calibration_contract";
  targetSha256: string;
  authoritativeWorkbookSha256: string;
}

type OverlayOperation = AddModuleOperation | ReplaceTokenOperation | CalibrationOperation;

interface IntegrationOverlay {
  patchId: string;
  status: "approved";
  operations: OverlayOperation[];
}

export interface AppliedIntegrationOverlay {
  modules: ModuleRecord[];
  modulesById: Map<string, ModuleRecord>;
  calibrationContract: CalibrationContract;
  errors: string[];
}

export async function applyIntegrationOverlay(options: {
  repositoryRoot: string;
  overlayFile: string;
}): Promise<AppliedIntegrationOverlay> {
  const overlay = JSON.parse(await readFile(options.overlayFile, "utf8")) as IntegrationOverlay;
  const errors: string[] = [];
  if (overlay.status !== "approved") errors.push(`${overlay.patchId}: overlay is not approved`);

  const targetPaths = [...new Set(overlay.operations.map((operation) => operation.targetPath))];
  const targetHashes = new Map<string, string>();
  for (const targetPath of targetPaths) {
    targetHashes.set(targetPath, await sha256File(path.resolve(options.repositoryRoot, targetPath)));
  }
  for (const operation of overlay.operations) {
    if (targetHashes.get(operation.targetPath) !== operation.targetSha256) {
      errors.push(`${operation.operationId}: target hash mismatch`);
    }
    if (
      operation.op === "declare_calibration_contract" &&
      (await sha256File(path.resolve(options.repositoryRoot, operation.authoritativeWorkbookPath))) !==
        operation.authoritativeWorkbookSha256
    ) {
      errors.push(`${operation.operationId}: authoritative workbook hash mismatch`);
    }
  }

  const registryOperation = overlay.operations.find(
    (operation): operation is AddModuleOperation => operation.op === "add_module",
  );
  if (!registryOperation) throw new Error("Overlay has no module registry operation");
  const modules = parse(
    await readFile(path.resolve(options.repositoryRoot, registryOperation.targetPath), "utf8"),
    { bom: true, columns: true, skip_empty_lines: true },
  ) as ModuleRecord[];
  const modulesById = new Map(modules.map((module) => [module.system_module_id ?? "", module]));

  for (const operation of overlay.operations) {
    if (operation.op === "add_module") {
      if (modulesById.has(operation.key)) {
        errors.push(`${operation.operationId}: module ${operation.key} already exists`);
      } else {
        const added = { ...operation.value };
        modules.push(added);
        modulesById.set(operation.key, added);
      }
    } else if (operation.op === "replace_token") {
      const module = modulesById.get(operation.key);
      if (!module) {
        errors.push(`${operation.operationId}: module ${operation.key} not found`);
        continue;
      }
      const current = module[operation.field];
      if (current === undefined || !current.includes(operation.oldValue)) {
        errors.push(`${operation.operationId}: token ${operation.oldValue} not found`);
        continue;
      }
      module[operation.field] = current.replace(operation.oldValue, operation.newValue);
    }
  }

  const calibration = overlay.operations.find(
    (operation): operation is CalibrationOperation =>
      operation.op === "declare_calibration_contract",
  );
  if (!calibration) throw new Error("Overlay has no calibration contract");
  const { targetPath, authoritativeWorkbookPath, sheet, range, legacyAction, expectedHeaders } = calibration;

  return {
    modules,
    modulesById,
    calibrationContract: {
      targetPath,
      authoritativeWorkbookPath,
      sheet,
      range,
      legacyAction,
      expectedHeaders,
    },
    errors,
  };
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
