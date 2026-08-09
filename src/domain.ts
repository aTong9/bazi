export const HEAVENLY_STEMS = [
  "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸",
] as const;

export const EARTHLY_BRANCHES = [
  "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
] as const;

export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];
export type Gender = "male" | "female";
export type TimeBasis = "civil" | "local_mean_solar" | "true_solar";
export type DayBoundary = "zi_initial_23" | "midnight_00";
export type QiyunMethod = "rounded_shichen" | "precise_minutes" | "precise_seconds";

interface BirthLocationInput {
  gender: Gender;
  localTime: string;
  timePrecision?: "exact" | "approximate" | "unknown";
  birthPlaceText?: string;
  countryCode?: string;
  timeZone: string;
  latitude: number;
  longitude: number;
}

export interface GregorianBirthInput extends BirthLocationInput {
  calendarType: "gregorian";
  localDate: string;
}

export interface LunarBirthInput extends BirthLocationInput {
  calendarType: "lunar";
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
}

export type BirthInput = GregorianBirthInput | LunarBirthInput;

export interface ChartConfig {
  timeBasis: TimeBasis;
  dayBoundary: DayBoundary;
  equationOfTimeMethod: "noaa_approximation";
  qiyunMethod: QiyunMethod;
}

export const DEFAULT_CHART_CONFIG: Readonly<ChartConfig> = {
  timeBasis: "true_solar",
  dayBoundary: "midnight_00",
  equationOfTimeMethod: "noaa_approximation",
  qiyunMethod: "precise_seconds",
};

export interface Pillar {
  stem: HeavenlyStem;
  branch: EarthlyBranch;
  text: string;
  hiddenStems: HeavenlyStem[];
  tenGodStem: string;
  tenGodHiddenStems: string[];
  naYin: string;
}

export interface TimeCalculation {
  originalLocalDateTime: string;
  utcDateTime: string;
  civilOffsetMinutes: number;
  standardOffsetMinutes: number;
  daylightSavingOffsetMinutes: number;
  standardMeridianDegrees: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalSolarCorrectionMinutes: number;
  localMeanSolarDateTime: string;
  trueSolarDateTime: string;
  selectedDateTime: string;
  selectedBasis: TimeBasis;
}

export interface FourPillarsChart {
  engineVersion: string;
  config: ChartConfig;
  input: BirthInput;
  normalizedGregorianInput: GregorianBirthInput;
  time: TimeCalculation;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
  baZi: string;
  dayMaster: HeavenlyStem;
  warnings: string[];
  trace: string[];
  luck: LuckPillars;
}

export interface MajorLuckPeriod {
  index: number;
  pillar: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
}

export interface LuckPillars {
  direction: "forward" | "backward";
  qiyunMethod: QiyunMethod;
  startOffset: {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
  };
  startsAt: string;
  periods: MajorLuckPeriod[];
}
