import { describe, expect, it } from "vitest";

import { analysisInputFingerprint, EARTHLY_BRANCHES, hourOptions, JIAZI, monthOptions, normalizeLinkedPillars, parsePillar, toWireCrossState, toWireObservations, toWireRealityGates, toWireSubject, type AnalysisFingerprintInput } from "./domain";
import type { CrossStateDraft, ObservationDraft, RealityGateDraft, SubjectDraft } from "./types";

const subject: SubjectDraft = {
  subjectId: "subject-a",
  year: "甲子",
  month: "丁卯",
  day: "甲寅",
  hour: "丁卯",
  birthTimeStatus: "exact",
  dataQuality: "high",
};

describe("four-pillar domain helpers", () => {
  it("builds the canonical sixty Jiazi without duplicates", () => {
    expect(JIAZI).toHaveLength(60);
    expect(new Set(JIAZI)).toHaveLength(60);
    expect(JIAZI[0]).toBe("甲子");
    expect(JIAZI[59]).toBe("癸亥");
  });

  it("links the month stem to the year stem with the five-tigers rule", () => {
    const options = monthOptions("甲子");
    expect(options).toHaveLength(12);
    expect(options.find((value) => value.endsWith("寅"))).toBe("丙寅");
    expect(options.find((value) => value.endsWith("卯"))).toBe("丁卯");
    expect(options.map((value) => value[1])).toEqual(EARTHLY_BRANCHES);
  });

  it("links the hour stem to the day stem with the five-rats rule", () => {
    const options = hourOptions("乙丑");
    expect(options[0]).toBe("丙子");
    expect(options[1]).toBe("丁丑");
    expect(options[11]).toBe("丁亥");
  });

  it("preserves selected branches while correcting linked stems", () => {
    const normalized = normalizeLinkedPillars({ ...subject, year: "己巳", month: "甲卯", day: "乙卯", hour: "甲午" });
    expect(normalized.month).toBe("丁卯");
    expect(normalized.hour).toBe("壬午");
  });

  it("sends the fixed timezone and omits an unknown hour", () => {
    const wire = toWireSubject({ ...subject, birthTimeStatus: "unknown" });
    expect(wire.timezone).toBe("Asia/Shanghai");
    expect(wire.four_pillars.hour).toBeNull();
    expect(wire.input_mode).toBe("four_pillars_provided");
  });

  it("rejects a stem-branch pair outside the sixty Jiazi", () => {
    expect(() => parsePillar("甲丑")).toThrow("无效干支");
  });

  it("sends only completed risk observations with stable chain provenance", () => {
    const observations: ObservationDraft[] = [
      { chainId: "M4-C01", slot: 0, source: "self_report", context: "  压力下反复打断沟通  ", direction: "supports", basisFingerprint: "fp-1", candidateFingerprint: "candidate-1", basisRequestId: "request-1" },
      { chainId: "M4-C01", slot: 1, source: "partner_report", context: "", direction: "contradicts", basisFingerprint: "fp-1", candidateFingerprint: "candidate-1", basisRequestId: "request-1" },
    ];
    expect(toWireObservations(observations, "run-1")).toEqual([{
      id: "ui-run-1-M4-C01-0",
      chainId: "M4-C01",
      source: "self_report",
      context: "压力下反复打断沟通",
      direction: "supports",
    }]);
  });

  it("excludes an observation when its request, input, or candidate binding is stale", () => {
    const observation: ObservationDraft = {
      chainId: "M4-C01", slot: 0, source: "self_report", context: "旧命盘观察", direction: "supports",
      basisFingerprint: "old-input", candidateFingerprint: "old-candidate", basisRequestId: "old-request",
    };
    expect(toWireObservations([observation], "run-2", {
      basisFingerprint: "new-input",
      basisRequestId: "new-request",
      candidateFingerprints: new Map([["M4-C01", "new-candidate"]]),
    })).toEqual([]);
  });

  it("downgrades an unsupported non-neutral gate instead of fabricating evidence", () => {
    const gates: RealityGateDraft[] = [{ id: "RG01", label: "安全", status: "pass", note: "   " }];
    expect(toWireRealityGates(gates, "run-3")).toEqual([{ id: "RG01", status: "unknown", evidenceIds: [] }]);
    expect(toWireRealityGates([{ ...gates[0]!, note: "双方可自由撤回同意" }], "run-3")).toEqual([{
      id: "RG01", status: "pass", evidenceIds: ["ui-run-3-RG01"], note: "双方可自由撤回同意",
    }]);
  });

  it("does not mark a checked cross-state as validated without a factual note", () => {
    const crossState = crossStateDraft();
    crossState.steady = true;
    expect(toWireCrossState(crossState, "run-4")).toEqual({
      validation: { steady: false, pressure: false, repair: false, turningPoint: false, counterevidenceReviewed: false },
      evidence: [],
    });
    crossState.evidence.steady = "连续三周的共同日程记录";
    expect(toWireCrossState(crossState, "run-4").evidence).toEqual([{
      state: "steady", note: "连续三周的共同日程记录", evidenceIds: ["ui-run-4-cross-steady"],
    }]);
  });

  it("changes the input fingerprint for a day-pillar edit and ignores observation text", () => {
    const base: AnalysisFingerprintInput = {
      analysisMode: "evaluate" as const,
      roleBasis: "female_traditional" as const,
      primarySubject: subject,
      hasSecondarySubject: false,
      secondarySubject: { ...subject, subjectId: "subject-b" },
      gates: [{ id: "RG01", label: "安全", status: "unknown" as const, note: "" }],
      crossState: crossStateDraft(),
    };
    const fingerprint = analysisInputFingerprint(base);
    expect(analysisInputFingerprint({ ...base, primarySubject: { ...subject, day: "乙卯" } })).not.toBe(fingerprint);
    expect(analysisInputFingerprint(structuredClone(base))).toBe(fingerprint);
  });
});

function crossStateDraft(): CrossStateDraft {
  return {
    steady: false, pressure: false, repair: false, turningPoint: false, counterevidenceReviewed: false,
    evidence: { steady: "", pressure: "", repair: "", turningPoint: "", counterevidenceReviewed: "" },
  };
}
