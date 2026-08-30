import path from "node:path";

import { createApiServer } from "./server.js";

const snapshotPath = process.env.BAZI_SNAPSHOT_PATH;
if (!snapshotPath) {
  process.stderr.write("BAZI_SNAPSHOT_PATH is required. Run npm run catalog:build, then set it to rulesets/<digest>.\n");
  process.exitCode = 2;
} else {
  const host = process.env.BAZI_HOST || "127.0.0.1";
  const port = parsePort(process.env.BAZI_PORT);
  const webRoot = path.resolve(process.env.BAZI_WEB_ROOT || "apps/web/dist");
  const server = createApiServer({ snapshotPath: path.resolve(snapshotPath), webRoot });
  server.listen(port, host, () => {
    process.stdout.write(`Bazi API listening on http://${host}:${port}\n`);
  });
  const shutdown = (): void => {
    server.close((error) => {
      if (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

function parsePort(value: string | undefined): number {
  const port = value === undefined ? 3000 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("BAZI_PORT must be an integer from 1 to 65535");
  return port;
}
