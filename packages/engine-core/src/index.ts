export interface FieldAuthorityRule {
  readonly fieldFamily: string;
  readonly authorityModuleId: string;
  readonly definition: string;
  readonly conflictPolicy: string;
}

export interface DecisionRecord {
  readonly decisionId: string;
  readonly kind: "field_authority";
  readonly actorModuleId: string;
  readonly fieldFamily: string;
  readonly authorityModuleId: string;
  readonly outcome: "accepted" | "rejected";
  readonly reason: string;
}

export class FieldAuthorityRegistry {
  readonly #rules: ReadonlyMap<string, FieldAuthorityRule>;

  constructor(rules: readonly FieldAuthorityRule[]) {
    const entries = new Map<string, FieldAuthorityRule>();
    for (const rule of rules) {
      if (entries.has(rule.fieldFamily)) throw new Error(`Duplicate field authority: ${rule.fieldFamily}`);
      entries.set(rule.fieldFamily, Object.freeze({ ...rule }));
    }
    this.#rules = entries;
  }

  decideWrite(actorModuleId: string, fieldFamily: string): DecisionRecord {
    const rule = this.#rules.get(fieldFamily);
    if (!rule) throw new Error(`Unknown field family: ${fieldFamily}`);
    const accepted = actorModuleId === rule.authorityModuleId;
    return Object.freeze({
      decisionId: stableDecisionId(actorModuleId, fieldFamily, rule.authorityModuleId),
      kind: "field_authority",
      actorModuleId,
      fieldFamily,
      authorityModuleId: rule.authorityModuleId,
      outcome: accepted ? "accepted" : "rejected",
      reason: accepted ? "actor_is_field_authority" : rule.conflictPolicy,
    });
  }
}

export class EvidenceLedger {
  readonly #sources = new Map<string, Set<string>>();
  readonly #events = new Map<string, Set<string>>();

  get uniqueSourceCount(): number { return this.#sources.size; }
  get uniqueEventCount(): number { return this.#events.size; }

  addSource(sourceId: string, fieldId: string): void {
    addReference(this.#sources, sourceId, fieldId);
  }

  addEvent(eventId: string, fieldId: string): void {
    addReference(this.#events, eventId, fieldId);
  }

  fieldsForSource(sourceId: string): readonly string[] {
    return Object.freeze([...(this.#sources.get(sourceId) ?? [])].sort());
  }

  fieldsForEvent(eventId: string): readonly string[] {
    return Object.freeze([...(this.#events.get(eventId) ?? [])].sort());
  }
}

function addReference(index: Map<string, Set<string>>, id: string, fieldId: string): void {
  if (!id || !fieldId) throw new Error("Evidence IDs and field IDs must be non-empty");
  const fields = index.get(id) ?? new Set<string>();
  fields.add(fieldId);
  index.set(id, fields);
}

function stableDecisionId(actor: string, field: string, authority: string): string {
  return `FIELD_AUTHORITY:${actor}:${field}:${authority}`;
}
