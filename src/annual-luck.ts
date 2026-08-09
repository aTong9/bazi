import { Solar } from "lunar-typescript";
import type { EarthlyBranch, FourPillarsChart, HeavenlyStem } from "./domain.js";
import {
  analyzeBranchGroups,
  analyzeBranchPair,
  analyzeStemPair,
  type GanzhiRelation,
  type RelationParticipant,
} from "./relations.js";
import { tenGodForStem } from "./ten-gods.js";

export const ANNUAL_LUCK_VERSION = "annual-luck-v1";

export interface AnnualLuck {
  algorithmVersion: typeof ANNUAL_LUCK_VERSION;
  source: { baZi: string; chartEngineVersion: string };
  year: number;
  pillar: string;
  stemTenGod: string;
  relations: GanzhiRelation[];
}

export function calculateAnnualLuck(
  chart: FourPillarsChart,
  startYear: number,
  endYear: number,
): AnnualLuck[] {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new RangeError("Annual-luck year range is invalid.");
  }
  if (endYear - startYear > 100) throw new RangeError("Annual-luck range cannot exceed 101 years.");

  const natalEntries = Object.entries(chart.pillars);
  return Array.from({ length: endYear - startYear + 1 }, (_, offset) => {
    const year = startYear + offset;
    const eightChar = Solar.fromYmdHms(year, 7, 1, 12, 0, 0).getLunar().getEightChar();
    const pillar = eightChar.getYear();
    const annualStem: RelationParticipant = {
      source: `annual:${year}:stem`,
      value: [...pillar][0]! as HeavenlyStem,
    };
    const annualBranch: RelationParticipant = {
      source: `annual:${year}:branch`,
      value: [...pillar][1]! as EarthlyBranch,
    };
    const relations = natalEntries.flatMap(([source, natal]) => [
      ...analyzeStemPair({ source: `${source}:stem`, value: natal.stem }, annualStem),
      ...analyzeBranchPair({ source: `${source}:branch`, value: natal.branch }, annualBranch),
    ]);
    relations.push(...analyzeBranchGroups([
      ...natalEntries.map(([source, natal]) => ({ source: `${source}:branch`, value: natal.branch })),
      annualBranch,
    ]).filter(relation => relation.participants.some(participant => participant.source === annualBranch.source)));
    return {
      algorithmVersion: ANNUAL_LUCK_VERSION,
      source: { baZi: chart.baZi, chartEngineVersion: chart.engineVersion },
      year,
      pillar,
      stemTenGod: tenGodForStem(chart.dayMaster, annualStem.value as HeavenlyStem),
      relations,
    };
  });
}
