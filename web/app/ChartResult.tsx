"use client";

import { presentNatalRelations } from "@bazi/core";
import { formatTimeZoneLabel } from "./time-zone-label";

/* eslint-disable @typescript-eslint/no-explicit-any -- Dense presentation helpers traverse several versioned core result types. */

const POSITIONS = ["year", "month", "day", "hour"] as const;
const POSITION_LABELS = { year: "年柱", month: "月柱", day: "日柱", hour: "时柱" } as const;
const ELEMENT_CLASS: Record<string, string> = { 木: "wood", 火: "fire", 土: "earth", 金: "metal", 水: "water" };

function elementClass(fact: any) {
  return `element-${ELEMENT_CLASS[fact?.element] ?? "neutral"}`;
}

function relationSummary(relations: any[]) {
  return relations?.slice(0, 2).map(item => item.description).join("、") || "—";
}

export function ChartResult({ result, personName, genderLabel, calendarLabel, place, birthLabel, feedback, setFeedback, onSave, onDelete, onExport, onExportFeedback, privacyNote }: any) {
  const { chart, derivedFacts } = result;
  const currentYear = new Date().getFullYear();
  const currentLuck = result.majorLuckInteractions.find((item: any) => currentYear >= item.startYear && currentYear <= item.endYear);
  const voidText = derivedFacts.void.branches.join("");
  const presentedRelations = presentNatalRelations(result.relations);
  const relationGroups = (["combination", "tension", "elemental"] as const)
    .map(group => ({ group, items: presentedRelations.filter(item => item.group === group) }))
    .filter(section => section.items.length > 0);

  return <section className="results chart-result" id="chart-result">
    <header className="chart-banner">
      <div className="chart-seal" aria-hidden="true">命</div>
      <div className="chart-title"><span>{personName}</span><strong>{chart.baZi}</strong></div>
      <div className="birth-lines"><p>输入：{birthLabel}</p><p>校正：{chart.time.selectedDateTime} <em>（{chart.time.selectedBasis}）</em></p></div>
      <div className="chart-toolbar"><button type="button" onClick={onSave}>保存</button><button type="button" onClick={onExport}>导出</button><button type="button" onClick={onDelete}>删除</button></div>
    </header>

    <article className="basic-info-card">
      <div className="basic-info-title"><div><span>基本信息</span><strong>{personName}</strong></div><small>数据来自本次输入与确定性排盘轨迹</small></div>
      <div className="basic-info-grid">
        <div className="info-label">姓名</div><div className="info-value">{personName}</div><div className="info-label">性别</div><div className="info-value">{genderLabel}</div>
        <div className="info-label">出生历法</div><div className="info-value">{calendarLabel}</div><div className="info-label">出生地区</div><div className="info-value">{place.displayName}</div>
        <div className="info-label">民用时间</div><div className="info-value mono">{chart.time.originalLocalDateTime}</div><div className="info-label">真太阳时</div><div className="info-value mono accent">{chart.time.trueSolarDateTime}</div>
        <div className="info-label">地方平太阳时</div><div className="info-value mono">{chart.time.localMeanSolarDateTime}</div><div className="info-label">法定时区</div><div className="info-value">{formatTimeZoneLabel(place.timeZone, place.countryCode)}</div>
        <div className="info-label">坐标</div><div className="info-value">{place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}°</div><div className="info-label">时间修正</div><div className="info-value">{chart.time.totalSolarCorrectionMinutes.toFixed(2)} 分钟</div>
        <div className="info-label">日主</div><div className="info-value accent">{chart.dayMaster} · {derivedFacts.stems.day.element}</div><div className="info-label">空亡</div><div className="info-value">{voidText}</div>
        <div className="info-label">起运</div><div className="info-value mono">{chart.luck.startsAt}</div><div className="info-label">大运方向</div><div className="info-value">{chart.luck.direction === "forward" ? "顺排" : "逆排"}</div>
        <div className="info-label">换日口径</div><div className="info-value">{chart.config.dayBoundary === "midnight_00" ? "零点换日" : "23 点换日"}</div><div className="info-label">起运算法</div><div className="info-value">{chart.luck.qiyunMethod}</div>
        <div className="info-label">时间精度</div><div className="info-value">{chart.input.timePrecision === "exact" ? "准确到分钟" : chart.input.timePrecision === "approximate" ? "大约时间" : "时间不确定"}</div><div className="info-label">计算引擎</div><div className="info-value">{chart.engineVersion}</div>
      </div>
      {chart.warnings.length > 0 && <div className="basic-info-warning"><b>边界提示</b><span>{chart.warnings.join("；")}</span></div>}
    </article>

    <div className="chart-workspace">
      <article className="bazi-sheet">
        <div className="sheet-caption"><strong>原局命盘</strong><span>日主 {chart.dayMaster} · {result.relationModel}</span></div>
        <div className="pillar-matrix">
          <div className="matrix-row matrix-head"><div>项目</div>{POSITIONS.map(position => <div key={position}>{POSITION_LABELS[position]}</div>)}</div>
          <div className="matrix-row"><div>主星</div>{POSITIONS.map(position => <div key={position} className="ten-god">{chart.pillars[position].tenGodStem}</div>)}</div>
          <div className="matrix-row matrix-ganzhi"><div>天干</div>{POSITIONS.map(position => <div key={position} className={elementClass(derivedFacts.stems[position])}>{chart.pillars[position].stem}<small>{derivedFacts.stems[position].element}</small></div>)}</div>
          <div className="matrix-row matrix-ganzhi"><div>地支</div>{POSITIONS.map(position => <div key={position} className={elementClass(derivedFacts.branches[position])}>{chart.pillars[position].branch}<small>{derivedFacts.branches[position].element}</small></div>)}</div>
          <div className="matrix-row hidden-row"><div>藏干</div>{POSITIONS.map(position => <div key={position}>{chart.pillars[position].hiddenStems.map((stem: string, index: number) => <span className={elementClass(derivedFacts.hiddenStems[position][index])} key={stem}>{stem}<small>{chart.pillars[position].tenGodHiddenStems[index]}</small></span>)}</div>)}</div>
          <div className="matrix-row"><div>星运</div>{POSITIONS.map(position => <div key={position}>{derivedFacts.twelveGrowth[position]}</div>)}</div>
          <div className="matrix-row"><div>空亡</div>{POSITIONS.map(position => <div key={position}>{derivedFacts.void.positions.includes(position) ? voidText : "—"}</div>)}</div>
          <div className="matrix-row"><div>纳音</div>{POSITIONS.map(position => <div key={position}>{chart.pillars[position].naYin}</div>)}</div>
          <div className="matrix-row muted-row"><div>神煞</div>{POSITIONS.map(position => <div key={position}>未启用</div>)}</div>
        </div>
        <div className="relation-notes"><p><b>天干留意：</b>{relationSummary(result.relations.filter((item: any) => item.participants?.every((p: any) => p.source.includes("stem"))))}</p><p><b>地支留意：</b>{relationSummary(result.relations.filter((item: any) => item.participants?.some((p: any) => p.source.includes("branch"))))}</p></div>
      </article>

      <article className="luck-sheet">
        <div className="luck-header"><div><strong>大运 · 流年</strong><span>{chart.luck.direction === "forward" ? "顺排" : "逆排"} · {chart.luck.startsAt} 起运</span></div><div className="current-luck">当前大运<b>{currentLuck?.pillar ?? "—"}</b></div></div>
        <div className="timeline-block"><div className="timeline-label">大运</div><div className="timeline-scroll">{result.majorLuckInteractions.map((item: any) => <div className={`timeline-cell ${item.index === currentLuck?.index ? "is-current" : ""}`} key={item.index}><small>{item.startYear}</small><span>{item.startAge}–{item.endAge}岁</span><strong>{item.pillar}</strong><em>{item.stemTenGod}</em><p>{relationSummary(item.relations)}</p></div>)}</div></div>
        <div className="timeline-block annual-block"><div className="timeline-label">流年</div><div className="timeline-scroll">{result.annualLuck.map((item: any) => <div className={`timeline-cell ${item.year === currentYear ? "is-current" : ""}`} key={item.year}><small>{item.year}</small><strong>{item.pillar}</strong><em>{item.stemTenGod}</em><p>{relationSummary(item.relations)}</p></div>)}</div></div>
        <div className="month-placeholder"><b>流月</b><span>当前引擎尚未计算流月，避免展示未经验证的数据。</span></div>
        <div className="season-band"><span>木相</span><span>火旺</span><span>土休</span><span>金囚</span><span>水死</span></div>
      </article>
    </div>

    {chart.warnings.length > 0 && <div className="warnings">{chart.warnings.join("；")}</div>}

    <div className="detail-grid">
      <article className="panel natal-relations-panel">
        <div className="relation-panel-head"><div><h3>原局作用关系</h3><p>先识别结构，再判断是否成局或合化</p></div><span>结构口径</span></div>
        {relationGroups.length ? <div className="relation-groups">{relationGroups.map(section => <section className={`relation-group relation-group-${section.group}`} key={section.group}>
          <h4>{section.items[0]?.groupLabel}<small>{section.items.length} 项</small></h4>
          <div className="relation-cards">{section.items.map((item, index) => <div className="relation-card" key={`${item.relation.kind}-${item.positions}-${index}`}>
            <div className="relation-card-title"><strong>{item.relation.description}</strong><span>{item.label}</span></div>
            <p className="relation-positions">{item.positions}</p>
            <p>{item.note}</p>
            {item.judgment === "transformation_review_required" && <em>合化 / 成局：待全局审核</em>}
          </div>)}</div>
        </section>)}</div> : <p className="relation-empty">未检出当前规则集中的显式关系</p>}
        <div className="relation-policy">参考顺序：三会 → 三合 → 六合；三刑 → 六冲 → 六害。该顺序用于组织观察，不直接覆盖距离、月令、根气和力量判断。</div>
      </article>
      <article className="panel"><h3>时间校正与口径</h3><p>民用时间：{chart.time.originalLocalDateTime}</p><p>平太阳时：{chart.time.localMeanSolarDateTime}</p><p>真太阳时：{chart.time.trueSolarDateTime}</p><details className="chapter"><summary><span>完整计算轨迹</span></summary>{chart.trace.map((line: string) => <p key={line}>{line}</p>)}</details></article>
      <article className="panel panel-wide"><h3>{result.localNarrative.title}<small> · 本地 JSON 模板</small></h3><p>{result.localNarrative.intro}</p><div className="chapter-list">{result.report.chapters.map((chapter: any) => <details className="chapter" key={chapter.id}><summary><span>{chapter.title}</span><em>{chapter.evidence.confidence === "high" ? "高" : chapter.evidence.confidence === "medium" ? "中" : "低"}置信度</em></summary>{result.localNarrative.chapters.find((item: any) => item.id === chapter.id)?.paragraphs.map((paragraph: any, index: number) => <p className={paragraph.label === "需要留意" ? "risk" : paragraph.label === "可观察的优势" ? "positive" : ""} key={`${chapter.id}-${index}`}>{paragraph.label ? `${paragraph.label} · ` : ""}{paragraph.text}</p>)}<div className="evidence">依据：{chapter.evidence.ruleIds.length ? chapter.evidence.ruleIds.join("、") : chapter.evidence.factPaths.join("、")}</div><div className="report-actions"><span>这段描述：</span>{([["matches", "符合"], ["does_not_match", "不符合"], ["cannot_judge", "无法判断"]] as const).map(([value, label]) => <button type="button" aria-pressed={feedback[chapter.id] === value} key={value} onClick={() => setFeedback((current: any) => ({ ...current, [chapter.id]: value }))}>{label}</button>)}</div></details>)}</div><div className="disclaimer">{result.localNarrative.disclaimer}</div><div className="report-actions"><button type="button" onClick={onExport}>导出报告 JSON</button><button type="button" disabled={!Object.keys(feedback).length} onClick={onExportFeedback}>导出匿名反馈</button><span>本地生成，默认不公开。</span></div>{privacyNote && <div className="privacy-note">{privacyNote}</div>}</article>
    </div>
  </section>;
}
