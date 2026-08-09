# Roadmap completion audit

Last audited: 2026-08-09. This file records evidence, not intent. “Implemented”
does not mean externally validated.

| Phase | Status | Evidence | Remaining gate |
|---|---|---|---|
| 0 口径冻结 | Implemented and externally observed | `docs/calendar-spec.md`; tracked offline replay of 120 boundary and 30 ordinary Wenzhen observations; `docs/wenzhen-compatibility-report.md` | Independent human approval of the calendar spec |
| 1 四柱排盘 | Implemented and externally validated for synthetic matrix | `src/calendar-input.ts`, `time.ts`, `four-pillars.ts`; HKO official 2023/2024 lunar-conversion golden cases; `test/fixtures/wenzhen-public-api-golden.json`; 30/30 ordinary Wenzhen matches; explained boundary differences | Broaden exact astronomical ephemeris providers when available |
| 2 派生与大运 | Implemented and externally validated for synthetic matrix | `derived-facts.ts`, `relations.ts`, `major-luck.ts`, `annual-luck.ts`; every relation/period/year carries algorithm and source provenance; second-precision qiyun; 30/30 ordinary Wenzhen major-luck/qiyun compatibility | Decide disputed hidden combination/transformation rules |
| 3 规则结构化 | All 16 roadmap themes registered; safe subset executable | `rule-schema.ts`, `relationship-rules.ts`; 16-theme coverage test; unresolved themes are atomic `review_required` entries | Human reviewer approval and definitions for strength/favorable-use dependencies |
| 4 规则执行 | Implemented for approved draft subset | `relationship-analysis.ts`; deterministic trace tests | Replay against human-labelled cases and tune weights through reviewed changes |
| 5 正式报告 | Functional, browser-local deterministic MVP | `report-engine.ts`, `web/app/local-chart.ts`, report UI and `narrative-templates.json`; selectable time/day/qiyun bases, visible calculation trace, local save/delete/export; static tests prove the client bundle contains no chart/place/narrative API dependency | Authenticated persistence/share and optional model-assisted rewriting are intentionally deferred; neither is required by the local MVP |
| 6 真实案例验证 | Infrastructure, privacy-minimized user feedback, plus public replay source | `case-validation.ts`, report chapter feedback UI/export, `public-case-validation.ts`, `docs/public-celebrity-case-policy.md`; Wenzhen exposes 35 unauthenticated celebrity rows | Feedback is explicitly not a truth label; public biographies contain no relationship-event labels; anonymous labelled cases and analyst baselines do not yet exist |
| 7 小红书内容 | Isolated draft and analytics engine | `content-engine.ts`, `content-analytics.ts`; seven-page/privacy tests; versioned import and score replay of the current workbook snapshot | Human source-script/editorial review and publication approval |

## Hard completion gates currently lacking evidence

1. No named human reviewer has approved the relationship rules or the unresolved
   strength/favorable-use algorithms.
2. No real anonymous case labels exist, so precision/recall cannot yet be
   reported honestly.
3. The product stores reports only when the user explicitly chooses browser-local
   storage. A multi-device account store and revocable server share links are
   intentionally absent until authentication and retention policy are chosen.

The software must not mark the roadmap/MVP complete while any gate above remains.
