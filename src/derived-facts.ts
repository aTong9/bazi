import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  type EarthlyBranch,
  type FourPillarsChart,
  type HeavenlyStem,
} from "./domain.js";

export const DERIVED_FACTS_VERSION = "derived-facts-v1";

type FiveElement = "木" | "火" | "土" | "金" | "水";
type YinYang = "阳" | "阴";
type PillarPosition = "year" | "month" | "day" | "hour";

const STEM_META: Record<HeavenlyStem, { element: FiveElement; yinYang: YinYang }> = {
  甲: { element: "木", yinYang: "阳" }, 乙: { element: "木", yinYang: "阴" },
  丙: { element: "火", yinYang: "阳" }, 丁: { element: "火", yinYang: "阴" },
  戊: { element: "土", yinYang: "阳" }, 己: { element: "土", yinYang: "阴" },
  庚: { element: "金", yinYang: "阳" }, 辛: { element: "金", yinYang: "阴" },
  壬: { element: "水", yinYang: "阳" }, 癸: { element: "水", yinYang: "阴" },
};

const BRANCH_META: Record<EarthlyBranch, { element: FiveElement; yinYang: YinYang }> = {
  子: { element: "水", yinYang: "阳" }, 丑: { element: "土", yinYang: "阴" },
  寅: { element: "木", yinYang: "阳" }, 卯: { element: "木", yinYang: "阴" },
  辰: { element: "土", yinYang: "阳" }, 巳: { element: "火", yinYang: "阴" },
  午: { element: "火", yinYang: "阳" }, 未: { element: "土", yinYang: "阴" },
  申: { element: "金", yinYang: "阳" }, 酉: { element: "金", yinYang: "阴" },
  戌: { element: "土", yinYang: "阳" }, 亥: { element: "水", yinYang: "阴" },
};

const GROWTH_PHASES = ["长生", "沐浴", "冠带", "临官", "帝旺", "衰", "病", "死", "墓", "绝", "胎", "养"] as const;
const GROWTH_START: Record<HeavenlyStem, EarthlyBranch> = {
  甲: "亥", 乙: "午", 丙: "寅", 丁: "酉", 戊: "寅",
  己: "酉", 庚: "巳", 辛: "子", 壬: "申", 癸: "卯",
};

const PEACH_BLOSSOM: Record<EarthlyBranch, EarthlyBranch> = {
  申: "酉", 子: "酉", 辰: "酉", 寅: "卯", 午: "卯", 戌: "卯",
  巳: "午", 酉: "午", 丑: "午", 亥: "子", 卯: "子", 未: "子",
};

const HIDDEN_WEIGHTS: Record<number, number[]> = {
  1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1],
};

function sexagenaryIndex(text: string): number {
  const chars = [...text];
  const stem = HEAVENLY_STEMS.indexOf(chars[0] as HeavenlyStem);
  const branch = EARTHLY_BRANCHES.indexOf(chars[1] as EarthlyBranch);
  for (let index = 0; index < 60; index += 1) {
    if (index % 10 === stem && index % 12 === branch) return index;
  }
  throw new Error(`Invalid sexagenary pillar: ${text}`);
}

function voidBranches(dayPillar: string): [EarthlyBranch, EarthlyBranch] {
  const xun = Math.floor(sexagenaryIndex(dayPillar) / 10);
  const first = (10 - xun * 2 + 12) % 12;
  return [EARTHLY_BRANCHES[first]!, EARTHLY_BRANCHES[(first + 1) % 12]!];
}

function growthPhase(dayMaster: HeavenlyStem, branch: EarthlyBranch): typeof GROWTH_PHASES[number] {
  const start = EARTHLY_BRANCHES.indexOf(GROWTH_START[dayMaster]);
  const target = EARTHLY_BRANCHES.indexOf(branch);
  const direction = STEM_META[dayMaster].yinYang === "阳" ? 1 : -1;
  const offset = ((target - start) * direction + 24) % 12;
  return GROWTH_PHASES[offset]!;
}

export interface DerivedChartFacts {
  algorithmVersion: typeof DERIVED_FACTS_VERSION;
  source: { baZi: string; engineVersion: string };
  stems: Record<PillarPosition, { value: HeavenlyStem; element: FiveElement; yinYang: YinYang }>;
  branches: Record<PillarPosition, { value: EarthlyBranch; element: FiveElement; yinYang: YinYang }>;
  hiddenStems: Record<PillarPosition, Array<{ value: HeavenlyStem; role: "main" | "middle" | "residual"; weight: number }>>;
  twelveGrowth: Record<PillarPosition, typeof GROWTH_PHASES[number]>;
  void: { branches: [EarthlyBranch, EarthlyBranch]; positions: PillarPosition[] };
  peachBlossom: Array<{ basis: "year" | "day"; target: EarthlyBranch; positions: PillarPosition[] }>;
}

export function deriveChartFacts(chart: FourPillarsChart): DerivedChartFacts {
  const positions: PillarPosition[] = ["year", "month", "day", "hour"];
  const stems = {} as DerivedChartFacts["stems"];
  const branches = {} as DerivedChartFacts["branches"];
  const hiddenStems = {} as DerivedChartFacts["hiddenStems"];
  const twelveGrowth = {} as DerivedChartFacts["twelveGrowth"];
  for (const position of positions) {
    const pillar = chart.pillars[position];
    stems[position] = { value: pillar.stem, ...STEM_META[pillar.stem] };
    branches[position] = { value: pillar.branch, ...BRANCH_META[pillar.branch] };
    const weights = HIDDEN_WEIGHTS[pillar.hiddenStems.length]!;
    hiddenStems[position] = pillar.hiddenStems.map((value, index) => ({
      value,
      role: (["main", "middle", "residual"] as const)[index]!,
      weight: weights[index]!,
    }));
    twelveGrowth[position] = growthPhase(chart.dayMaster, pillar.branch);
  }
  const empty = voidBranches(chart.pillars.day.text);
  const peachBlossom = (["year", "day"] as const).map((basis) => {
    const target = PEACH_BLOSSOM[chart.pillars[basis].branch];
    return { basis, target, positions: positions.filter((position) => chart.pillars[position].branch === target) };
  });
  return {
    algorithmVersion: DERIVED_FACTS_VERSION,
    source: { baZi: chart.baZi, engineVersion: chart.engineVersion },
    stems, branches, hiddenStems, twelveGrowth,
    void: { branches: empty, positions: positions.filter((position) => empty.includes(chart.pillars[position].branch)) },
    peachBlossom,
  };
}
