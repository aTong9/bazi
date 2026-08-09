import type { EarthlyBranch, FourPillarsChart, HeavenlyStem } from "./domain.js";
import { analyzeBranchGroups, analyzeBranchPair, analyzeStemPair, type GanzhiRelation, type RelationParticipant } from "./relations.js";
import { tenGodForStem } from "./ten-gods.js";

export const MAJOR_LUCK_INTERACTIONS_VERSION = "major-luck-interactions-v1";

export interface MajorLuckInteraction {
  algorithmVersion: typeof MAJOR_LUCK_INTERACTIONS_VERSION;
  source: { baZi: string; chartEngineVersion: string; qiyunMethod: string };
  index: number;
  pillar: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
  stemTenGod: string;
  relations: GanzhiRelation[];
}

export function calculateMajorLuckInteractions(chart: FourPillarsChart): MajorLuckInteraction[] {
  const natalEntries = Object.entries(chart.pillars);
  return chart.luck.periods.map(period => {
    const [stem, branch] = [...period.pillar] as [HeavenlyStem, EarthlyBranch];
    const luckStem: RelationParticipant = { source: `dayun:${period.index}:stem`, value: stem };
    const luckBranch: RelationParticipant = { source: `dayun:${period.index}:branch`, value: branch };
    const relations = natalEntries.flatMap(([source, natal]) => [
      ...analyzeStemPair({ source: `${source}:stem`, value: natal.stem }, luckStem),
      ...analyzeBranchPair({ source: `${source}:branch`, value: natal.branch }, luckBranch),
    ]);
    relations.push(...analyzeBranchGroups([
      ...natalEntries.map(([source, natal]) => ({ source: `${source}:branch`, value: natal.branch })),
      luckBranch,
    ]).filter(relation => relation.participants.some(participant => participant.source === luckBranch.source)));
    return {
      algorithmVersion: MAJOR_LUCK_INTERACTIONS_VERSION,
      source: { baZi: chart.baZi, chartEngineVersion: chart.engineVersion, qiyunMethod: chart.luck.qiyunMethod },
      ...period,
      stemTenGod: tenGodForStem(chart.dayMaster, stem),
      relations,
    };
  });
}
