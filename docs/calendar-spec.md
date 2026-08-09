# Calendar and chart specification v1

Status: frozen for `calendar-engine 0.1.x`. Any incompatible change requires a
new `chartConfigVersion` and new golden fixtures.

## Supported scope

- Gregorian and Chinese lunar inputs whose normalized Gregorian date is from
  1900-01-01 through 2100-12-31.
- Any place resolvable to latitude/longitude and an IANA time-zone identifier.
- Proleptic Gregorian calendar internally. Dates before the supported range are
  rejected rather than silently switching to the Julian calendar.
- Input precision is minute-level or better. Approximate/unknown birth times
  must be retained by the product and must not produce high-confidence
  hour-pillar conclusions.

## Frozen defaults

| Concern | Default | Alternatives |
|---|---|---|
| Year boundary | exact 立春 | none in v1 |
| Month boundary | exact 十二节 | none in v1 |
| Time basis | true solar | civil, local mean solar |
| Day boundary | 00:00 | 23:00 initial Zi |
| Zi hour | unified 23:00–00:59 | configuration represented by day boundary |
| Dayun direction | year-stem yin/yang + gender | none in v1 |
| Qiyun | precise interval, 三天一年 | rounded shichen |

The selected basis is applied before hour and configurable day-boundary
calculation. The engine uses IANA historical offsets. A civil timestamp in a
DST interval is converted through its historical zone offset; the solar-time
calculation then uses the standard meridian and explicitly records the DST
component.

## Version fields

- `calendarEngineVersion`: implementation version.
- `chartConfigVersion`: `chart-config-v1` for the table above.
- `equationOfTimeMethod`: `noaa_approximation`.
- `timezoneDatabaseVersion`: supplied by the runtime/deployment manifest.
- `ephemerisVersion`: the pinned `lunar-typescript` adapter version until an
  independent astronomical adapter is introduced.

## Boundary behavior

The response records original, UTC, mean-solar, true-solar and selected
timestamps plus every correction. Inputs within 15 minutes of an hour boundary,
inside Zi hour, or whose result changes under an alternative configured basis
must display a warning. Differences with external tools are classified by
time basis, day boundary, DST interpretation, exact solar-term instant or
qiyun rounding; date-specific patches are forbidden.

## Known research item, not a hidden default

“早晚子时分柱不分日” is not independently implemented in v1 because the
current adapter exposes the two common day-change sects. If external samples
prove a third behavior is needed, it becomes a new explicit configuration—not
an alteration of either existing mode.

## Independent calendar evidence

`test/fixtures/hko-lunar-conversion-golden.json` records 14 month-start cases
from the Hong Kong Observatory's official 2023 and 2024 Gregorian–Lunar
conversion tables, including regular and leap second-month starts. These cases
validate lunar input normalization only. The HKO tables publish solar terms at
day precision, so they are not used as evidence for exact Jie seconds or BaZi
school conventions.
