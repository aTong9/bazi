import { existsSync } from "node:fs";
import path from "node:path";

import { readCalibrationReadiness } from "../packages/calibration/src/store.js";

const argument = process.argv.find((value) => value.startsWith("--database="));
const databasePath = argument?.slice("--database=".length) || process.env.CALIBRATION_DATABASE_PATH;

if (!databasePath) {
  process.stderr.write("CALIBRATION_DATABASE_REQUIRED: pass --database=/absolute/path/calibration.sqlite or CALIBRATION_DATABASE_PATH\n");
  process.exitCode = 2;
} else {
  const resolved = path.resolve(databasePath);
  if (!existsSync(resolved)) {
    process.stderr.write(`CALIBRATION_DATABASE_NOT_FOUND: ${resolved}\n`);
    process.exitCode = 2;
  } else {
    const readiness = readCalibrationReadiness(resolved);
    const releaseCandidateReady = readiness.M4.releaseCandidateReady && readiness.M5.releaseCandidateReady;
    process.stdout.write(`${JSON.stringify({ databasePath: resolved, releaseCandidateReady, readiness }, null, 2)}\n`);
    if (!releaseCandidateReady) process.exitCode = 1;
  }
}
