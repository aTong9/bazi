import { Solar } from "lunar-typescript";

import type { Pillar } from "../../domain/src/birth-input.js";

export const CALENDAR_ADAPTER = Object.freeze({
  id: "lunar-typescript-standard-time",
  version: "1.8.6",
  civilTimeBasis: "UTC+08:00",
  trueSolarTimeApplied: false,
  solarTermSafetyMinutes: 30,
  hourBoundarySafetyMinutes: 2,
});

export type SolarBirthResolution =
  | {
      readonly status: "resolved";
      readonly fourPillars: FourPillars;
      readonly localDateTime: string;
      readonly provenance: typeof CALENDAR_ADAPTER;
    }
  | {
      readonly status: "boundary_unresolved";
      readonly reason: "solar_term" | "zi_hour_convention" | "hour_boundary";
      readonly message: string;
      readonly localDateTime: string;
      readonly candidates: readonly FourPillars[];
      readonly provenance: typeof CALENDAR_ADAPTER;
    }
  | {
      readonly status: "invalid" | "unsupported";
      readonly message: string;
      readonly localDateTime: string;
      readonly provenance: typeof CALENDAR_ADAPTER;
    };

export interface FourPillars {
  readonly year: Pillar;
  readonly month: Pillar;
  readonly day: Pillar;
  readonly hour: Pillar;
}

export function isCurrentCalendarAdapter(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const adapter = value as Record<string, unknown>;
  return adapter.id === CALENDAR_ADAPTER.id
    && adapter.version === CALENDAR_ADAPTER.version
    && adapter.civilTimeBasis === CALENDAR_ADAPTER.civilTimeBasis
    && adapter.trueSolarTimeApplied === CALENDAR_ADAPTER.trueSolarTimeApplied;
}

const MONTH_BOUNDARY_NAMES = new Set([
  "立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒",
  "LI_CHUN", "JING_ZHE", "QING_MING", "LI_XIA", "MANG_ZHONG", "XIAO_SHU",
  "LI_QIU", "BAI_LU", "HAN_LU", "LI_DONG", "DA_XUE", "XIAO_HAN",
]);

export function resolveSolarBirth(localDateTime: string): SolarBirthResolution {
  const parsed = parseLocalDateTime(localDateTime);
  if (!parsed) return terminal("invalid", "请输入有效的公历日期和准确时间。", localDateTime);
  if (parsed.year < 1901 || parsed.year > 2099) {
    return terminal("unsupported", "自动排盘当前只支持 1901—2099 年。", localDateTime);
  }

  const inputMinute = localMinuteValue(parsed);
  if (parsed.hour === 23) {
    return boundary("zi_hour_convention", "23 时涉及换日流派差异，请核对交界前后候选并改用手动四柱。", localDateTime, [
      pillarsAt({ ...parsed, hour: 22, minute: 59 }),
      pillarsAt(nextCivilDay(parsed)),
    ]);
  }
  const minutesIntoDay = parsed.hour * 60 + parsed.minute;
  const nearestHourBoundary = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]
    .map((hour) => ({ hour, distance: Math.abs(minutesIntoDay - hour * 60) }))
    .sort((left, right) => left.distance - right.distance)[0]!;
  if (nearestHourBoundary.distance <= CALENDAR_ADAPTER.hourBoundarySafetyMinutes) {
    const boundaryValue = { ...parsed, hour: nearestHourBoundary.hour, minute: 0 };
    return boundary("hour_boundary", "时间紧邻时辰交界，请核对更精确的出生分钟后再排盘。", localDateTime, [
      pillarsAt(shiftLocalMinutes(boundaryValue, -(CALENDAR_ADAPTER.hourBoundarySafetyMinutes + 1))),
      pillarsAt(shiftLocalMinutes(boundaryValue, CALENDAR_ADAPTER.hourBoundarySafetyMinutes + 1)),
    ]);
  }

  const solar = Solar.fromYmdHms(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute, 0);
  const term = Object.entries(solar.getLunar().getJieQiTable())
    .filter(([name]) => MONTH_BOUNDARY_NAMES.has(name))
    .map(([name, value]) => ({ name, value, distance: Math.abs(localMinuteValue(fromSolar(value)) - inputMinute) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (term && term.distance <= CALENDAR_ADAPTER.solarTermSafetyMinutes) {
    const boundaryValue = fromSolar(term.value);
    return boundary("solar_term", `时间接近${displayTermName(term.name)}交节，系统不自动选择交节前后命盘。`, localDateTime, [
      pillarsAt(shiftLocalMinutes(boundaryValue, -(CALENDAR_ADAPTER.solarTermSafetyMinutes + 1))),
      pillarsAt(shiftLocalMinutes(boundaryValue, CALENDAR_ADAPTER.solarTermSafetyMinutes + 1)),
    ]);
  }
  return { status: "resolved", fourPillars: pillarsAt(parsed), localDateTime, provenance: CALENDAR_ADAPTER };
}

function pillarsAt(input: DateParts): FourPillars {
  const eightChar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, 0).getLunar().getEightChar();
  return {
    year: pillar(eightChar.getYear()), month: pillar(eightChar.getMonth()),
    day: pillar(eightChar.getDay()), hour: pillar(eightChar.getTime()),
  };
}

function pillar(value: string): Pillar {
  if (value.length !== 2) throw new Error(`calendar adapter returned an invalid pillar: ${value}`);
  return { stem: value[0] as Pillar["stem"], branch: value[1] as Pillar["branch"] };
}

interface DateParts { year: number; month: number; day: number; hour: number; minute: number }

function parseLocalDateTime(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = parts as [number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day
    || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) return null;
  return { year, month, day, hour, minute };
}

function fromSolar(solar: Solar): DateParts {
  return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(), hour: solar.getHour(), minute: solar.getMinute() };
}

function localMinuteValue(input: DateParts): number {
  return Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute) / 60_000;
}

function shiftLocalMinutes(input: DateParts, amount: number): DateParts {
  const date = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes() };
}

function nextCivilDay(input: DateParts): DateParts { return shiftLocalMinutes({ ...input, hour: 0, minute: 0 }, 24 * 60); }

function boundary(reason: Extract<SolarBirthResolution, { status: "boundary_unresolved" }>["reason"], message: string, localDateTime: string, candidates: FourPillars[]): SolarBirthResolution {
  const unique = [...new Map(candidates.map((candidate) => [formatFourPillars(candidate), candidate])).values()];
  return { status: "boundary_unresolved", reason, message, localDateTime, candidates: Object.freeze(unique), provenance: CALENDAR_ADAPTER };
}

function terminal(status: "invalid" | "unsupported", message: string, localDateTime: string): SolarBirthResolution {
  return { status, message, localDateTime, provenance: CALENDAR_ADAPTER };
}

function displayTermName(value: string): string {
  const values: Record<string, string> = { LI_CHUN: "立春", JING_ZHE: "惊蛰", QING_MING: "清明", LI_XIA: "立夏", MANG_ZHONG: "芒种", XIAO_SHU: "小暑", LI_QIU: "立秋", BAI_LU: "白露", HAN_LU: "寒露", LI_DONG: "立冬", DA_XUE: "大雪", XIAO_HAN: "小寒" };
  return values[value] ?? value;
}

export function formatFourPillars(value: FourPillars): string {
  return [value.year, value.month, value.day, value.hour].map((item) => `${item.stem}${item.branch}`).join(" ");
}
