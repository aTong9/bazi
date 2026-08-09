import { describe, expect, it } from "vitest";
import { RELATIONSHIP_RULES, RELATIONSHIP_RULE_THEMES, validateRelationshipRule, validateRuleSet } from "../src/index.js";

describe("relationship rule schema", () => {
  it("validates every draft rule and keeps unresolved research out of approved rules", () => {
    expect(validateRuleSet(RELATIONSHIP_RULES)).toEqual([]);
    expect(RELATIONSHIP_RULES.filter(rule => rule.status === "approved").length).toBeGreaterThanOrEqual(10);
    expect(RELATIONSHIP_RULES.filter(rule => rule.status === "review_required").every(rule => rule.dependencies.some(item => item.startsWith("research.")))).toBe(true);
  });

  it("registers every roadmap relationship theme with existing atomic rules", () => {
    expect(RELATIONSHIP_RULE_THEMES).toHaveLength(16);
    const ids = new Set(RELATIONSHIP_RULES.map(rule => rule.id));
    for (const theme of RELATIONSHIP_RULE_THEMES) {
      expect(theme.ruleIds.length, theme.title).toBeGreaterThan(0);
      expect(theme.ruleIds.every(id => ids.has(id)), theme.title).toBe(true);
    }
  });

  it("rejects absolute language and unresolved dependencies in approved rules", () => {
    const invalid = { ...RELATIONSHIP_RULES[0]!, dependencies: ["research.strength"], outputs: { ...RELATIONSHIP_RULES[0]!.outputs, risk: "一定婚姻不好" } };
    expect(validateRelationshipRule(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining("forbidden absolute term"),
      expect.stringContaining("unresolved research"),
    ]));
  });
});
