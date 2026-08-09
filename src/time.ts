import { Temporal } from "@js-temporal/polyfill";
import type { GregorianBirthInput, TimeBasis, TimeCalculation } from "./domain.js";

const MINUTES_PER_DEGREE = 4;

function parsePlainDateTime(input: GregorianBirthInput): Temporal.PlainDateTime {
  return Temporal.PlainDateTime.from(`${input.localDate}T${input.localTime}`);
}

function offsetMinutes(zoned: Temporal.ZonedDateTime): number {
  return zoned.offsetNanoseconds / 60_000_000_000;
}

function standardMeridian(offset: number): number {
  return (offset / 60) * 15;
}

function inferStandardOffsetMinutes(year: number, timeZone: string): number {
  const monthlyOffsets = Array.from({ length: 12 }, (_, index) => {
    const sample = Temporal.PlainDateTime.from({
      year,
      month: index + 1,
      day: 15,
      hour: 12,
    }).toZonedDateTime(timeZone, { disambiguation: "compatible" });
    return offsetMinutes(sample);
  });
  return Math.min(...monthlyOffsets);
}

export function approximateEquationOfTimeMinutes(dayOfYear: number): number {
  const b = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function withMinuteCorrection(
  dateTime: Temporal.PlainDateTime,
  minutes: number,
): Temporal.PlainDateTime {
  const wholeNanoseconds = Math.round(minutes * 60 * 1_000_000_000);
  return dateTime.add({ nanoseconds: wholeNanoseconds });
}

function selectDateTime(
  basis: TimeBasis,
  civil: Temporal.PlainDateTime,
  meanSolar: Temporal.PlainDateTime,
  trueSolar: Temporal.PlainDateTime,
): Temporal.PlainDateTime {
  if (basis === "civil") return civil;
  if (basis === "local_mean_solar") return meanSolar;
  return trueSolar;
}

export function calculateTime(
  input: GregorianBirthInput,
  basis: TimeBasis,
): { calculation: TimeCalculation; selected: Temporal.PlainDateTime } {
  const civil = parsePlainDateTime(input);
  const zoned = civil.toZonedDateTime(input.timeZone, { disambiguation: "reject" });
  const civilOffset = offsetMinutes(zoned);
  const standardOffset = inferStandardOffsetMinutes(civil.year, input.timeZone);
  const daylightSavingOffset = civilOffset - standardOffset;
  const meridian = standardMeridian(standardOffset);
  const longitudeCorrection = (input.longitude - meridian) * MINUTES_PER_DEGREE;
  const standardCivil = withMinuteCorrection(civil, -daylightSavingOffset);
  const meanSolar = withMinuteCorrection(standardCivil, longitudeCorrection);
  const equationOfTime = approximateEquationOfTimeMinutes(civil.dayOfYear);
  const trueSolar = withMinuteCorrection(meanSolar, equationOfTime);
  const selected = selectDateTime(basis, civil, meanSolar, trueSolar);

  return {
    calculation: {
      originalLocalDateTime: zoned.toString(),
      utcDateTime: zoned.toInstant().toString(),
      civilOffsetMinutes: civilOffset,
      standardOffsetMinutes: standardOffset,
      daylightSavingOffsetMinutes: daylightSavingOffset,
      standardMeridianDegrees: meridian,
      longitudeCorrectionMinutes: longitudeCorrection,
      equationOfTimeMinutes: equationOfTime,
      totalSolarCorrectionMinutes:
        -daylightSavingOffset + longitudeCorrection + equationOfTime,
      localMeanSolarDateTime: meanSolar.toString(),
      trueSolarDateTime: trueSolar.toString(),
      selectedDateTime: selected.toString(),
      selectedBasis: basis,
    },
    selected,
  };
}
