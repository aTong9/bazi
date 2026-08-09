# Human review workspace

Run `./scripts/review-wizard.sh`. The wizard creates three git-ignored files:

- `wenzhen-observations.json` — external chart observations and screenshot references.
- `rule-approvals.json` — named approval decisions for every rule.
- `anonymous-case-labels.json` — private replay inputs and analyst baselines.

These files can contain sensitive birth data and must not be committed. Store
screenshots under the git-ignored `review/screenshots/` directory. The tracked
schemas describe their structure; the local CLI validates values before each
atomic write.

Running `node scripts/review-cli.mjs init` again is non-destructive: existing
answers are preserved, newly defined compatibility candidates are added by
`caseId`, and newly structured rules are added by `ruleId`. Rules removed from
the current code are removed from the active checklist while retained decisions
for unchanged IDs survive metadata/title updates. The
current matrix contains 120 boundary cases and 30 ordinary cases. Ordinary
cases must match 100%; every boundary difference needs an explanation, and
every observation must reference either a screenshot or raw API evidence.

Synthetic compatibility evidence can also be collected from the public endpoint
used by the Wenzhen web client:

```bash
npm run build
node scripts/collect-wenzhen-api.mjs --scope all --limit 150 --refresh
```

This stores raw JSON under ignored `review/api-evidence/`; it never treats JSON
as a screenshot. `validate` accepts either source as external evidence and
reports both counts separately.

问真名人页属于另一类公开证据。运行
`node scripts/collect-wenzhen-celebrities.mjs` 可保存未登录接口当前开放的
案例。其用途和排除规则见 `docs/public-celebrity-case-policy.md`；它不计入
匿名真人标签数量，也不替代规则审核人签署。
