import type { DomainIssue } from "./index.js";

export const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];

export interface Pillar {
  readonly stem: HeavenlyStem;
  readonly branch: EarthlyBranch;
}

export interface FourPillarsProvidedInput {
  readonly inputMode: "four_pillars_provided";
  readonly subjectId: string;
  readonly fourPillars: {
    readonly year: Pillar;
    readonly month: Pillar;
    readonly day: Pillar;
    readonly hour: Pillar | null;
  };
  readonly birthTimeStatus: "exact" | "approximate" | "unknown";
  readonly timezone?: string;
  readonly dataQuality: "high" | "medium" | "low" | "unknown";
  readonly syntheticFixture?: boolean;
}

export type BirthInputValidation =
  | { readonly ok: true; readonly value: FourPillarsProvidedInput; readonly limited: boolean }
  | { readonly ok: false; readonly issues: readonly DomainIssue[] };

export function validateBirthInput(input: FourPillarsProvidedInput): BirthInputValidation {
  const issues: DomainIssue[] = [];
  if (!input.subjectId.trim()) issues.push(issue("E_SUBJECT_ID_REQUIRED", "subjectId is required", "/subjectId"));
  if (input.birthTimeStatus === "exact" && input.fourPillars.hour === null) {
    issues.push(issue("E_EXACT_HOUR_REQUIRED", "exact birth time requires an hour pillar", "/fourPillars/hour"));
  }
  if (input.birthTimeStatus === "unknown" && input.fourPillars.hour !== null) {
    issues.push(issue("E_UNKNOWN_HOUR_MUST_BE_NULL", "unknown birth time requires hour=null", "/fourPillars/hour"));
  }
  const pillars: Array<[string, Pillar | null]> = [
    ["year", input.fourPillars.year], ["month", input.fourPillars.month],
    ["day", input.fourPillars.day], ["hour", input.fourPillars.hour],
  ];
  for (const [name, pillar] of pillars) {
    if (pillar && !input.syntheticFixture && !isSexagenaryPillar(pillar)) {
      issues.push(issue("E_INVALID_PILLAR", `${name} is not a valid sexagenary pillar`, `/fourPillars/${name}`));
    }
  }
  if (!input.syntheticFixture && issues.length === 0) {
    if (!monthStemMatchesYear(input.fourPillars.year.stem, input.fourPillars.month)) {
      issues.push(issue("E_FIVE_TIGERS_MISMATCH", "month stem does not match year stem and month branch", "/fourPillars/month"));
    }
    if (input.fourPillars.hour && !hourStemMatchesDay(input.fourPillars.day.stem, input.fourPillars.hour)) {
      issues.push(issue("E_FIVE_RATS_MISMATCH", "hour stem does not match day stem and hour branch", "/fourPillars/hour"));
    }
  }
  return issues.length > 0
    ? { ok: false, issues: Object.freeze(issues) }
    : { ok: true, value: input, limited: input.birthTimeStatus !== "exact" };
}

export function isSexagenaryPillar(pillar: { stem: string; branch: string }): pillar is Pillar {
  const stemIndex = HEAVENLY_STEMS.indexOf(pillar.stem as HeavenlyStem);
  const branchIndex = EARTHLY_BRANCHES.indexOf(pillar.branch as EarthlyBranch);
  return stemIndex >= 0 && branchIndex >= 0 && stemIndex % 2 === branchIndex % 2;
}

function monthStemMatchesYear(yearStem: HeavenlyStem, month: Pillar): boolean {
  const tigerStarts: Record<HeavenlyStem, HeavenlyStem> = {
    甲: "丙", 己: "丙", 乙: "戊", 庚: "戊", 丙: "庚",
    辛: "庚", 丁: "壬", 壬: "壬", 戊: "甲", 癸: "甲",
  };
  const branchOffset = (EARTHLY_BRANCHES.indexOf(month.branch) - EARTHLY_BRANCHES.indexOf("寅") + 12) % 12;
  const expected = HEAVENLY_STEMS[(HEAVENLY_STEMS.indexOf(tigerStarts[yearStem]) + branchOffset) % 10];
  return month.stem === expected;
}

function hourStemMatchesDay(dayStem: HeavenlyStem, hour: Pillar): boolean {
  const ratStarts: Record<HeavenlyStem, HeavenlyStem> = {
    甲: "甲", 己: "甲", 乙: "丙", 庚: "丙", 丙: "戊",
    辛: "戊", 丁: "庚", 壬: "庚", 戊: "壬", 癸: "壬",
  };
  const offset = EARTHLY_BRANCHES.indexOf(hour.branch);
  const expected = HEAVENLY_STEMS[(HEAVENLY_STEMS.indexOf(ratStarts[dayStem]) + offset) % 10];
  return hour.stem === expected;
}

function issue(code: string, message: string, jsonPointer: string): DomainIssue {
  return { code, severity: "error", stage: "birth_input", message, jsonPointer, retryable: false };
}
