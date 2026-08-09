import { createFourPillarsChart } from "./four-pillars.js";
import type { BirthInput, DayBoundary, Gender, TimeBasis } from "./domain.js";

export interface WenzhenObservation {
  adjustedTime: string;
  fourPillars: string;
  qiyunAge: string;
  dayun: string[];
  screenshotReference: string;
  apiEvidenceReference?: string;
  evidenceSource?: "browser_screenshot" | "public_api";
  qiyunStartsAt?: string;
  qiyunDifferenceMinutes?: number;
  fourPillarsMatch?: boolean;
  dayunMatch?: boolean;
  qiyunMatch?: boolean;
}

export interface WenzhenCandidate {
  caseId: string;
  dimension: string;
  boundary: boolean;
  input: BirthInput;
  settings: { timeBasis: TimeBasis; dayBoundary: DayBoundary };
  localEngineOutput: { selectedTime: string; fourPillars: string; qiyunStartsAt: string; dayun: string[] };
  wenzhenObserved: WenzhenObservation | null;
  match: boolean | null;
  differenceReason: string;
}

const PLACES = [
  { name: "上海", timeZone: "Asia/Shanghai", latitude: 31.2304, longitude: 121.4737, countryCode: "CN" },
  { name: "乌鲁木齐", timeZone: "Asia/Shanghai", latitude: 43.8256, longitude: 87.6168, countryCode: "CN" },
  { name: "拉萨", timeZone: "Asia/Shanghai", latitude: 29.652, longitude: 91.1721, countryCode: "CN" },
  { name: "哈尔滨", timeZone: "Asia/Shanghai", latitude: 45.8038, longitude: 126.535, countryCode: "CN" },
  { name: "纽约", timeZone: "America/New_York", latitude: 40.7128, longitude: -74.006, countryCode: "US" },
  { name: "伦敦", timeZone: "Europe/London", latitude: 51.5074, longitude: -0.1278, countryCode: "GB" },
] as const;

function makeCandidate(caseId: string, dimension: string, boundary: boolean, localDate: string, localTime: string, placeIndex: number, gender: Gender, timeBasis: TimeBasis, dayBoundary: DayBoundary): WenzhenCandidate {
  const place = PLACES[placeIndex % PLACES.length]!;
  const input: BirthInput = { calendarType: "gregorian", gender, localDate, localTime, timePrecision: "exact", birthPlaceText: place.name, countryCode: place.countryCode, timeZone: place.timeZone, latitude: place.latitude, longitude: place.longitude };
  const chart = createFourPillarsChart(input, { timeBasis, dayBoundary });
  return { caseId, dimension, boundary, input, settings: { timeBasis, dayBoundary }, localEngineOutput: { selectedTime: chart.time.selectedDateTime, fourPillars: chart.baZi, qiyunStartsAt: chart.luck.startsAt, dayun: chart.luck.periods.map(period => period.pillar) }, wenzhenObserved: null, match: null, differenceReason: "" };
}

export function createWenzhenCandidates(): WenzhenCandidate[] {
  const times = ["22:59:00", "23:00:00", "23:30:00", "23:59:00", "00:00:00", "00:30:00", "00:59:00", "01:00:00"];
  const dates = ["1986-05-04", "1987-04-12", "1988-04-17", "1989-04-16", "1990-04-15", "1991-04-14"];
  const result: WenzhenCandidate[] = [];
  for (const [dateIndex, localDate] of dates.entries()) for (const [timeIndex, localTime] of times.entries()) for (const timeBasis of ["civil", "true_solar"] as const) {
    result.push(makeCandidate(`dst-zi-${dateIndex + 1}-${timeIndex + 1}-${timeBasis}`, "DST × 子时 × 经度", true, localDate, localTime, dateIndex + timeIndex, (dateIndex + timeIndex) % 2 ? "male" : "female", timeBasis, timeIndex < 4 ? "zi_initial_23" : "midnight_00"));
  }
  const terms = [
    ["立春", "2024-02-04", "16:26:07", "16:28:07"], ["惊蛰", "2024-03-05", "10:21:45", "10:23:45"],
    ["清明", "2024-04-04", "15:01:17", "15:03:17"], ["立夏", "2024-05-05", "08:09:05", "08:11:05"],
    ["芒种", "2024-06-05", "12:08:54", "12:10:54"], ["小暑", "2024-07-06", "22:19:03", "22:21:03"],
    ["立秋", "2024-08-07", "08:08:16", "08:10:16"], ["白露", "2024-09-07", "11:10:20", "11:12:20"],
    ["寒露", "2024-10-08", "02:58:57", "03:00:57"], ["立冬", "2024-11-07", "06:19:04", "06:21:04"],
    ["大雪", "2024-12-06", "23:16:03", "23:18:03"], ["小寒", "2024-01-06", "04:48:22", "04:50:22"],
  ] as const;
  for (const [index, [term, date, before, after]] of terms.entries()) for (const [side, localTime] of [["before-1m", before], ["after-1m", after]] as const) {
    result.push(makeCandidate(`jie-${index + 1}-${side}`, `${term} ${side}`, true, date, localTime, 0, index % 2 ? "male" : "female", "civil", "midnight_00"));
  }
  const ordinaryDates = ["1978-09-18", "1994-06-21", "2001-11-09", "2012-03-17", "2020-10-26"];
  for (const [dateIndex, localDate] of ordinaryDates.entries()) for (let placeIndex = 0; placeIndex < PLACES.length; placeIndex += 1) {
    result.push(makeCandidate(`ordinary-${dateIndex + 1}-${placeIndex + 1}`, "非边界常规盘", false, localDate, "12:34:00", placeIndex, (dateIndex + placeIndex) % 2 ? "male" : "female", placeIndex % 2 ? "true_solar" : "civil", "midnight_00"));
  }
  return result;
}

function normalizePillars(value: string): string { return value.trim().replace(/\s+/g, " "); }
function candidateMatches(item: WenzhenCandidate): boolean {
  if (item.match !== null) return item.match;
  return Boolean(item.wenzhenObserved && normalizePillars(item.wenzhenObserved.fourPillars) === normalizePillars(item.localEngineOutput.fourPillars));
}

export interface WenzhenCompatibilityMetrics {
  total: number;
  observed: number;
  matched: number;
  matchRate: number | null;
  fourPillarsMatched: number;
  fourPillarsMatchRate: number | null;
  dayunMatched: number;
  dayunMatchRate: number | null;
  qiyunMatched: number;
  qiyunMatchRate: number | null;
  nonBoundary: { total: number; observed: number; matched: number; matchRate: number | null; fourPillarsMatched: number; fourPillarsMatchRate: number | null; dayunMatched: number; dayunMatchRate: number | null; qiyunMatched: number; qiyunMatchRate: number | null };
  boundary: { total: number; observed: number; matched: number; explainedDifferences: number; unexplainedDifferences: number };
  screenshotsPresent: number;
  apiEvidencePresent: number;
}

export function evaluateWenzhenCandidates(candidates: WenzhenCandidate[]): WenzhenCompatibilityMetrics {
  const observed = candidates.filter(item => item.wenzhenObserved);
  const matched = observed.filter(candidateMatches);
  const fourPillarsMatched = observed.filter(item => normalizePillars(item.wenzhenObserved!.fourPillars) === normalizePillars(item.localEngineOutput.fourPillars));
  const dayunMatched = observed.filter(item => item.wenzhenObserved!.dayun.length > 0 && item.localEngineOutput.dayun.every((pillar, index) => item.wenzhenObserved!.dayun[index] === pillar));
  const qiyunMatched = observed.filter(item => item.wenzhenObserved!.qiyunMatch === true);
  const nonBoundary = candidates.filter(item => !item.boundary);
  const observedNonBoundary = nonBoundary.filter(item => item.wenzhenObserved);
  const matchedNonBoundary = observedNonBoundary.filter(candidateMatches);
  const nonBoundaryPillars = observedNonBoundary.filter(item => normalizePillars(item.wenzhenObserved!.fourPillars) === normalizePillars(item.localEngineOutput.fourPillars));
  const nonBoundaryDayun = observedNonBoundary.filter(item => item.wenzhenObserved!.dayunMatch === true || (item.wenzhenObserved!.dayun.length > 0 && item.localEngineOutput.dayun.every((pillar, index) => item.wenzhenObserved!.dayun[index] === pillar)));
  const nonBoundaryQiyun = observedNonBoundary.filter(item => item.wenzhenObserved!.qiyunMatch === true);
  const boundary = candidates.filter(item => item.boundary);
  const observedBoundary = boundary.filter(item => item.wenzhenObserved);
  const matchedBoundary = observedBoundary.filter(candidateMatches);
  const differingBoundary = observedBoundary.filter(item => !matchedBoundary.includes(item));
  return {
    total: candidates.length,
    observed: observed.length,
    matched: matched.length,
    matchRate: observed.length ? matched.length / observed.length : null,
    fourPillarsMatched: fourPillarsMatched.length,
    fourPillarsMatchRate: observed.length ? fourPillarsMatched.length / observed.length : null,
    dayunMatched: dayunMatched.length,
    dayunMatchRate: observed.length ? dayunMatched.length / observed.length : null,
    qiyunMatched: qiyunMatched.length,
    qiyunMatchRate: observed.length ? qiyunMatched.length / observed.length : null,
    nonBoundary: {
      total: nonBoundary.length, observed: observedNonBoundary.length, matched: matchedNonBoundary.length, matchRate: observedNonBoundary.length ? matchedNonBoundary.length / observedNonBoundary.length : null,
      fourPillarsMatched: nonBoundaryPillars.length, fourPillarsMatchRate: observedNonBoundary.length ? nonBoundaryPillars.length / observedNonBoundary.length : null,
      dayunMatched: nonBoundaryDayun.length, dayunMatchRate: observedNonBoundary.length ? nonBoundaryDayun.length / observedNonBoundary.length : null,
      qiyunMatched: nonBoundaryQiyun.length, qiyunMatchRate: observedNonBoundary.length ? nonBoundaryQiyun.length / observedNonBoundary.length : null,
    },
    boundary: { total: boundary.length, observed: observedBoundary.length, matched: matchedBoundary.length, explainedDifferences: differingBoundary.filter(item => item.differenceReason.trim()).length, unexplainedDifferences: differingBoundary.filter(item => !item.differenceReason.trim()).length },
    screenshotsPresent: observed.filter(item => item.wenzhenObserved!.screenshotReference.trim()).length,
    apiEvidencePresent: observed.filter(item => item.wenzhenObserved!.apiEvidenceReference?.trim()).length,
  };
}
