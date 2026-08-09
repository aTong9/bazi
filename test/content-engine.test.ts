import { describe, expect, it } from "vitest";
import { generateXiaohongshuDraft, scoreContentTopic, validateXiaohongshuDraft } from "../src/index.js";

describe("isolated Xiaohongshu content engine", () => {
  it("creates a seven-page, evidence-backed knowledge draft that cannot auto-publish", () => {
    const draft = generateXiaohongshuDraft({ type: "knowledge", topicId: "关系安全感", approved: true, signals: [
      { label: "只藏不透", behavior: "需要更长时间确认自己的关系需求。", ruleId: "relationship.spouse-star.hidden-only" },
      { label: "夫妻宫见冲", behavior: "环境变化时需要重新协商相处方式。", ruleId: "relationship.spouse-palace.clash" },
      { label: "桃花位置", behavior: "互动机会不等于长期关系质量。", ruleId: "relationship.peach-blossom.position" },
    ], action: "下一次不安时，先说出一个具体感受和一个具体请求。" });
    expect(draft.pages).toHaveLength(7);
    expect(draft.publishStatus).toBe("draft_only");
    expect(validateXiaohongshuDraft(draft)).toEqual([]);
  });

  it("rejects unreviewed sources and private birth fields", () => {
    expect(() => generateXiaohongshuDraft({ type: "case", caseId: "c1", approved: false, features: [], relationshipPattern: "", changeDirection: "", evidenceRuleIds: [] })).toThrow(/human-approved/);
    const unsafe = { type: "case", caseId: "c2", approved: true, features: ["x"], relationshipPattern: "x", changeDirection: "x", evidenceRuleIds: ["r"], birthDate: "1990-01-01" } as never;
    expect(() => generateXiaohongshuDraft(unsafe)).toThrow(/private field/);
  });

  it("scores topic metrics deterministically", () => {
    expect(scoreContentTopic({ impressions: 1000, views: 500, comments: 10, saves: 20, followers: 5 })).toBe(0.326);
  });
});
