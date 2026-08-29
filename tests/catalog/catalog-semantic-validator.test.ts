import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { importCatalog } from "../../packages/catalog/src/import-catalog.js";
import { validateCatalogSemantics } from "../../packages/catalog/src/semantic-validator.js";

test("catalog semantic validation rejects an M20 fixture entering runtime", async () => {
  const catalog = await importCatalog({ repositoryRoot: path.resolve(".") });
  assert.deepEqual(validateCatalogSemantics(catalog.records), []);
  const fixture = catalog.fixtures[0];
  assert.ok(fixture);
  const invalid = [...catalog.records, { ...fixture, id: `${fixture.id}-runtime`, runtimeEligible: true }];
  assert.ok(validateCatalogSemantics(invalid).some((issue) => issue.code === "E_GOVERNANCE_IN_RUNTIME"));
});
