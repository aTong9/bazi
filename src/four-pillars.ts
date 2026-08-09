import { EightChar, Solar } from "lunar-typescript";
import { Temporal } from "@js-temporal/polyfill";
import {
  type BirthInput,
  DEFAULT_CHART_CONFIG,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  type ChartConfig,
  type EarthlyBranch,
  type FourPillarsChart,
  type GregorianBirthInput,
  type HeavenlyStem,
  type LuckPillars,
  type Pillar,
} from "./domain.js";
import { normalizeBirthInput } from "./calendar-input.js";
import { calculateTime } from "./time.js";

export const CALENDAR_ENGINE_VERSION = "0.2.0";

function assertCoordinate(value: number, min: number, max: number, label: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}.`);
  }
}

function validateInput(input: GregorianBirthInput): void {
  assertCoordinate(input.latitude, -90, 90, "latitude");
  assertCoordinate(input.longitude, -180, 180, "longitude");
}

function stem(value: string): HeavenlyStem {
  if (!HEAVENLY_STEMS.includes(value as HeavenlyStem)) {
    throw new Error(`Unsupported heavenly stem: ${value}`);
  }
  return value as HeavenlyStem;
}

function branch(value: string): EarthlyBranch {
  if (!EARTHLY_BRANCHES.includes(value as EarthlyBranch)) {
    throw new Error(`Unsupported earthly branch: ${value}`);
  }
  return value as EarthlyBranch;
}

function makePillar(
  text: string,
  hiddenStems: string[],
  tenGodStem: string,
  tenGodHiddenStems: string[],
  naYin: string,
): Pillar {
  const chars = [...text];
  const stemText = chars[0];
  const branchText = chars[1];
  if (!stemText || !branchText) throw new Error(`Invalid pillar: ${text}`);
  return {
    stem: stem(stemText),
    branch: branch(branchText),
    text,
    hiddenStems: hiddenStems.map(stem),
    tenGodStem,
    tenGodHiddenStems,
    naYin,
  };
}

function boundaryWarnings(input: GregorianBirthInput, selectedHour: number, selectedMinute: number): string[] {
  const warnings: string[] = [];
  const minutesOfDay = selectedHour * 60 + selectedMinute;
  const nearestTwoHourBoundary = Math.min(
    ...Array.from({ length: 13 }, (_, index) => Math.abs(minutesOfDay - (60 + index * 120))),
    Math.abs(minutesOfDay - 23 * 60),
  );
  if (nearestTwoHourBoundary <= 15) {
    warnings.push("采用时间距离时辰边界不超过15分钟，时间校正可能改变时柱。");
  }
  if (minutesOfDay >= 23 * 60 || minutesOfDay < 60) {
    warnings.push("出生时间位于子时，日柱结果受换日口径影响，请核对 dayBoundary 配置。");
  }
  if (input.localTime.length < 5) {
    warnings.push("出生时间精度不足，时柱结果可能不稳定。");
  }
  if (input.timePrecision === "approximate") {
    warnings.push("出生时间为约数，时柱和起运相关结论已标记为低置信度使用场景。");
  } else if (input.timePrecision === "unknown") {
    warnings.push("出生时间未知，不应生成确定的时柱、起运或时柱相关个体结论。");
  }
  return warnings;
}

function createLuckPillars(
  eightChar: EightChar,
  gender: BirthInput["gender"],
  config: ChartConfig,
): LuckPillars {
  const qiyunSect = config.qiyunMethod === "rounded_shichen" ? 1 : 2;
  const yun = eightChar.getYun(gender === "male" ? 1 : 0, qiyunSect);
  let startOffset = {
    years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay(), hours: yun.getStartHour(), minutes: 0,
  };
  let startsAt = yun.getStartSolar().toYmdHms();
  if (config.qiyunMethod === "precise_seconds") {
    const lunar = eightChar.getLunar();
    const current = lunar.getSolar();
    const boundary = yun.isForward() ? lunar.getNextJie().getSolar() : lunar.getPrevJie().getSolar();
    const seconds = Math.round(Math.abs(boundary.getJulianDay() - current.getJulianDay()) * 86_400);
    let ageMinutes = seconds * 2;
    const years = Math.floor(ageMinutes / 518_400); ageMinutes -= years * 518_400;
    const months = Math.floor(ageMinutes / 43_200); ageMinutes -= months * 43_200;
    const days = Math.floor(ageMinutes / 1_440); ageMinutes -= days * 1_440;
    const hours = Math.floor(ageMinutes / 60); ageMinutes -= hours * 60;
    startOffset = { years, months, days, hours, minutes: ageMinutes };
    startsAt = Temporal.PlainDateTime.from(current.toYmdHms().replace(" ", "T")).add(startOffset).toString().replace("T", " ");
  }
  const periods = yun
    .getDaYun(9)
    .filter((period) => period.getIndex() > 0)
    .map((period) => ({
      index: period.getIndex(),
      pillar: period.getGanZhi(),
      startAge: period.getStartAge(),
      endAge: period.getEndAge(),
      startYear: period.getStartYear(),
      endYear: period.getEndYear(),
    }));
  return {
    direction: yun.isForward() ? "forward" : "backward",
    qiyunMethod: config.qiyunMethod,
    startOffset,
    startsAt,
    periods,
  };
}

export function createFourPillarsChart(
  input: BirthInput,
  overrides: Partial<ChartConfig> = {},
): FourPillarsChart {
  const normalizedInput = normalizeBirthInput(input);
  validateInput(normalizedInput);
  const config: ChartConfig = { ...DEFAULT_CHART_CONFIG, ...overrides };
  const { calculation, selected } = calculateTime(normalizedInput, config.timeBasis);
  const solar = Solar.fromYmdHms(
    selected.year,
    selected.month,
    selected.day,
    selected.hour,
    selected.minute,
    selected.second,
  );
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(config.dayBoundary === "zi_initial_23" ? 1 : 2);

  const year = makePillar(
    eightChar.getYear(),
    eightChar.getYearHideGan(),
    eightChar.getYearShiShenGan(),
    eightChar.getYearShiShenZhi(),
    eightChar.getYearNaYin(),
  );
  const month = makePillar(
    eightChar.getMonth(),
    eightChar.getMonthHideGan(),
    eightChar.getMonthShiShenGan(),
    eightChar.getMonthShiShenZhi(),
    eightChar.getMonthNaYin(),
  );
  const day = makePillar(
    eightChar.getDay(),
    eightChar.getDayHideGan(),
    eightChar.getDayShiShenGan(),
    eightChar.getDayShiShenZhi(),
    eightChar.getDayNaYin(),
  );
  const hour = makePillar(
    eightChar.getTime(),
    eightChar.getTimeHideGan(),
    eightChar.getTimeShiShenGan(),
    eightChar.getTimeShiShenZhi(),
    eightChar.getTimeNaYin(),
  );
  const luck = createLuckPillars(eightChar, input.gender, config);

  const trace = [
    `原始出生时间：${calculation.originalLocalDateTime}`,
    `夏令时修正：${(-calculation.daylightSavingOffsetMinutes).toFixed(3)} 分钟`,
    `经度修正：${calculation.longitudeCorrectionMinutes.toFixed(3)} 分钟`,
    `均时差：${calculation.equationOfTimeMinutes.toFixed(3)} 分钟`,
    `采用时间：${calculation.selectedDateTime} (${config.timeBasis})`,
    `换日口径：${config.dayBoundary}`,
    `四柱：${year.text} ${month.text} ${day.text} ${hour.text}`,
    `大运：${luck.direction}，${luck.startsAt} 起运`,
  ];

  return {
    engineVersion: CALENDAR_ENGINE_VERSION,
    config,
    input,
    normalizedGregorianInput: normalizedInput,
    time: calculation,
    pillars: { year, month, day, hour },
    baZi: `${year.text} ${month.text} ${day.text} ${hour.text}`,
    dayMaster: day.stem,
    warnings: boundaryWarnings(normalizedInput, selected.hour, selected.minute),
    trace,
    luck,
  };
}
