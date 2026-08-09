import {
  GANZHI_RELATIONS_VERSION,
  analyzeChartRelations,
  analyzeRelationship,
  calculateAnnualLuck,
  calculateMajorLuckInteractions,
  createFourPillarsChart,
  createRelationshipReport,
  deriveChartFacts,
  type BirthInput,
  type ChartConfig,
  type RelationshipReport,
} from "@bazi/core";
import narrativeTemplates from "./data/narrative-templates.json" with { type: "json" };

export interface LocalNarrativeChapter {
  id: string;
  title: string;
  paragraphs: Array<{ label: string; text: string }>;
  evidenceRuleIds: string[];
}

export interface LocalNarrative {
  version: string;
  title: string;
  intro: string;
  chapters: LocalNarrativeChapter[];
  disclaimer: string;
}

export function createLocalNarrative(report: RelationshipReport): LocalNarrative {
  return {
    version: narrativeTemplates.version,
    title: narrativeTemplates.title,
    intro: narrativeTemplates.intro,
    chapters: report.chapters.map((chapter) => {
      const paragraphs = [
        { label: "", text: chapter.summary },
        ...chapter.positives.map((text) => ({ label: narrativeTemplates.positiveLabel, text })),
        ...chapter.risks.map((text) => ({ label: narrativeTemplates.riskLabel, text })),
        ...chapter.advice.map((text) => ({ label: narrativeTemplates.adviceLabel, text })),
      ].filter((item) => item.text.trim().length > 0);
      return {
        id: chapter.id,
        title: chapter.title,
        paragraphs: paragraphs.length ? paragraphs : [{ label: "", text: narrativeTemplates.emptyText }],
        evidenceRuleIds: chapter.evidence.ruleIds,
      };
    }),
    disclaimer: `${report.disclaimer} ${narrativeTemplates.disclaimer}`,
  };
}

export function createLocalChartResult(
  birth: BirthInput,
  config?: Partial<ChartConfig>,
  options: { currentYear?: number; generatedAt?: string; annualStartYear?: number; annualEndYear?: number } = {},
) {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const chart = createFourPillarsChart(birth, config);
  const report = createRelationshipReport(chart, generatedAt);
  return {
    ok: true as const,
    executionMode: "browser-local" as const,
    relationModel: GANZHI_RELATIONS_VERSION,
    chart,
    derivedFacts: deriveChartFacts(chart),
    relations: analyzeChartRelations(chart),
    relationship: analyzeRelationship(chart),
    report,
    localNarrative: createLocalNarrative(report),
    majorLuckInteractions: calculateMajorLuckInteractions(chart),
    annualLuck: calculateAnnualLuck(
      chart,
      options.annualStartYear ?? currentYear - 1,
      options.annualEndYear ?? currentYear + 5,
    ),
  };
}

export type LocalChartResult = ReturnType<typeof createLocalChartResult>;
