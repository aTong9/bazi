# Wenzhen compatibility report

Last run: 2026-08-09. This report describes synthetic test evidence captured
from the public endpoint used by the Wenzhen web client. It is not a claim that
Wenzhen documents or guarantees its internal algorithm.

## Reproduction

```bash
npm run build
node scripts/review-cli.mjs init
node scripts/collect-wenzhen-api.mjs --scope all --limit 150 --refresh
node scripts/review-cli.mjs validate
node scripts/promote-wenzhen-fixture.mjs
npm test
```

Raw responses are written to the ignored `review/api-evidence/` directory and
linked from `review/wenzhen-observations.json`. Inputs are synthetic.
The promotion step writes a sanitized, tracked snapshot to
`test/fixtures/wenzhen-public-api-golden.json`; it omits raw payloads, reviewer
metadata, and local evidence paths. CI replays all 150 observations without
network access.

## Results

- Evidence collected: 150/150.
- Ordinary cases: 30/30 compatible for four pillars, first eight major-luck
  pillars, and qiyun time.
- Boundary cases: 96/120 fully compatible.
- Explained boundary differences: 24; unexplained differences: 0.
- Four pillars across all cases: 145/150 exact.
- First eight major-luck pillars across all cases: 145/150 exact.
- Qiyun across all cases: 126/150 within the ephemeris precision threshold.

Qiyun compatibility allows at most 20 qiyun-minutes, equivalent to ten seconds
at the real Jie boundary under the three-days-per-year conversion. The exact
difference remains recorded for every case.

## Inferred settings

- Wenzhen `yzs=0` corresponds to unified Zi hour: 23:00 changes the day.
- Wenzhen `yzs=1` corresponds to early/late Zi hour: the 23:00 segment retains
  the civil calendar day.
- The endpoint must receive whole seconds. Fractional seconds do not affect its
  pillars but corrupt its qiyun array, so the collector mirrors the UI format.
- Five 2024 Jie probes switch earlier than the pinned lunar-typescript Jie
  instant. These are retained as ephemeris/configuration differences rather
  than patched by date.

## Local correction

The previous `precise_minutes` qiyun path discarded the final real seconds and
therefore up to two qiyun-hours. `precise_seconds` now converts the exact Jie
interval continuously (one real second equals two qiyun-minutes) and is the
default. The older method and rounded-shichen method remain selectable for
compatibility research.
