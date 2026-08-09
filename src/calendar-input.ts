import { Lunar } from "lunar-typescript";
import { Temporal } from "@js-temporal/polyfill";
import type { BirthInput, GregorianBirthInput, LunarBirthInput } from "./domain.js";

function timeParts(localTime: string): [number, number, number] {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localTime);
  if (!match) throw new RangeError("localTime must use HH:mm or HH:mm:ss format.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new RangeError("localTime is outside the valid clock range.");
  }
  return [hour, minute, second];
}

function assertSupportedDate(localDate: string): void {
  let date: Temporal.PlainDate;
  try { date = Temporal.PlainDate.from(localDate); }
  catch { throw new RangeError("localDate must be a valid ISO date in YYYY-MM-DD format."); }
  if (date.toString() !== localDate) throw new RangeError("localDate must use canonical YYYY-MM-DD format.");
  if (Temporal.PlainDate.compare(date, "1900-01-01") < 0 || Temporal.PlainDate.compare(date, "2100-12-31") > 0) {
    throw new RangeError("Birth date is outside the supported range 1900-01-01 through 2100-12-31.");
  }
}

function normalizeLunar(input: LunarBirthInput): GregorianBirthInput {
  const [hour, minute, second] = timeParts(input.localTime);
  const encodedMonth = input.isLeapMonth ? -input.lunarMonth : input.lunarMonth;
  let lunar: Lunar;
  try {
    lunar = Lunar.fromYmdHms(
      input.lunarYear,
      encodedMonth,
      input.lunarDay,
      hour,
      minute,
      second,
    );
  } catch (error) {
    throw new RangeError(`Invalid lunar date: ${(error as Error).message}`);
  }
  if (
    lunar.getYear() !== input.lunarYear ||
    lunar.getMonth() !== encodedMonth ||
    lunar.getDay() !== input.lunarDay
  ) {
    throw new RangeError("Invalid lunar date or leap-month selection.");
  }
  const solar = lunar.getSolar();
  const localDate = solar.toYmd();
  assertSupportedDate(localDate);
  return {
    calendarType: "gregorian",
    gender: input.gender,
    localDate,
    localTime: solar.toYmdHms().slice(11),
    ...(input.timePrecision ? { timePrecision: input.timePrecision } : {}),
    ...(input.birthPlaceText ? { birthPlaceText: input.birthPlaceText } : {}),
    ...(input.countryCode ? { countryCode: input.countryCode } : {}),
    timeZone: input.timeZone,
    latitude: input.latitude,
    longitude: input.longitude,
  };
}

export function normalizeBirthInput(input: BirthInput): GregorianBirthInput {
  if (input.calendarType === "gregorian") {
    timeParts(input.localTime);
    assertSupportedDate(input.localDate);
    return input;
  }
  return normalizeLunar(input);
}
