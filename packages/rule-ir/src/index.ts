export type Scalar = string | number | boolean | null;

export type Predicate =
  | { readonly kind: "all"; readonly predicates: readonly Predicate[] }
  | { readonly kind: "any"; readonly predicates: readonly Predicate[] }
  | { readonly kind: "not"; readonly predicate: Predicate }
  | { readonly kind: "equals"; readonly field: string; readonly value: Scalar }
  | { readonly kind: "in"; readonly field: string; readonly values: readonly Scalar[] }
  | { readonly kind: "exists"; readonly field: string }
  | { readonly kind: "relationExists"; readonly relation: string; readonly participants: readonly string[] }
  | {
      readonly kind: "compareEvidence";
      readonly left: string;
      readonly operator: "gt" | "gte" | "eq" | "lte" | "lt";
      readonly right: string | number;
    };

export interface RuleEffect {
  readonly kind: "set" | "add_evidence" | "stop" | "emit_issue";
  readonly output: string;
  readonly value?: Scalar;
}

export interface SourceReference {
  readonly sourceFile: string;
  readonly sourceSheet?: string;
  readonly sourceRow: number;
  readonly nativeReference: string;
  readonly sourceVersion: string;
  readonly sourceHash: string;
  readonly nativePayload: Readonly<Record<string, string>>;
}

export type CompilationDisposition =
  | "compiled"
  | "reference_only"
  | "guardrail"
  | "test_only"
  | "governance"
  | "unsupported_with_reason";

export interface PredicateRule {
  readonly kind: "predicate_rule";
  readonly id: string;
  readonly moduleId: string;
  readonly when: Predicate;
  readonly unless: readonly Predicate[];
  readonly effects: readonly RuleEffect[];
  readonly priority: number;
  readonly source: SourceReference;
}

export interface ReferenceDatum {
  readonly kind: "reference_datum";
  readonly id: string;
  readonly moduleId: string;
  readonly source: SourceReference;
}

export interface OutputFieldContract {
  readonly kind: "output_field_contract";
  readonly id: string;
  readonly moduleId: string;
  readonly outputSlot: string;
  readonly source: SourceReference;
}

export interface RelationRecognitionRule extends Omit<PredicateRule, "kind"> {
  readonly kind: "relation_recognition_rule";
}

export interface RelationEffectRule extends Omit<PredicateRule, "kind"> {
  readonly kind: "relation_effect_rule";
}

export interface GuardrailRule extends Omit<PredicateRule, "kind"> {
  readonly kind: "guardrail_rule";
  readonly stopCode: string;
}

export type CompiledRecord =
  | PredicateRule
  | RelationRecognitionRule
  | RelationEffectRule
  | GuardrailRule
  | ReferenceDatum
  | OutputFieldContract;
