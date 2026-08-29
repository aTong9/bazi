import type { CanonicalCatalogRecord } from "../../catalog/src/import-catalog.js";

export interface RelationshipRuleCatalog { getModuleRecords(moduleId: string): readonly CanonicalCatalogRecord[] }
export function field(record: CanonicalCatalogRecord, name: string): string { return record.source.nativePayload[name] ?? ""; }
export function unique(values: readonly string[]): readonly string[] { return Object.freeze([...new Set(values)].filter(Boolean)); }
