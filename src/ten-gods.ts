import type { HeavenlyStem } from "./domain.js";

const STEM_INDEX: Record<HeavenlyStem, number> = {
  甲: 0, 乙: 1, 丙: 2, 丁: 3, 戊: 4, 己: 5, 庚: 6, 辛: 7, 壬: 8, 癸: 9,
};
const ELEMENT_INDEX = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const TEN_GODS = ["比肩", "劫财", "食神", "伤官", "偏财", "正财", "七杀", "正官", "偏印", "正印"];

export function tenGodForStem(dayMaster: HeavenlyStem, target: HeavenlyStem): string {
  const dayIndex = STEM_INDEX[dayMaster];
  const targetIndex = STEM_INDEX[target];
  const dayElement = ELEMENT_INDEX[dayIndex]!;
  const targetElement = ELEMENT_INDEX[targetIndex]!;
  const elementDelta = (targetElement - dayElement + 5) % 5;
  const samePolarity = dayIndex % 2 === targetIndex % 2;
  const baseByElementDelta = [0, 2, 4, 6, 8];
  return TEN_GODS[baseByElementDelta[elementDelta]! + (samePolarity ? 0 : 1)]!;
}
