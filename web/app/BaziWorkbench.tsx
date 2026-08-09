"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, jsx-a11y/label-has-associated-control -- Feedback exports traverse versioned report chapters; compact grouped labels keep the birth form readable. */

import { FormEvent, useState } from "react";
import type { BirthInput, ChartConfig } from "@bazi/core";
import { ChartResult } from "./ChartResult";
import { PlacePicker, type PlaceChoice } from "./PlacePicker";
import { createLocalChartResult, type LocalChartResult } from "./local-chart";

type Place = PlaceChoice;

const DEFAULT_PLACE: Place = { displayName: "中国 上海市 上海市 黄浦区", countryCode: "CN", province: "上海市", city: "上海市", district: "黄浦区", latitude: 31.2304, longitude: 121.4737, timeZone: "Asia/Shanghai" };

export function BaziWorkbench() {
  const [personName, setPersonName] = useState("");
  const [calendar, setCalendar] = useState<"gregorian" | "lunar">("gregorian");
  const [gender, setGender] = useState<BirthInput["gender"]>("female");
  const [date, setDate] = useState("1990-06-15");
  const [time, setTime] = useState("10:30");
  const [timePrecision, setTimePrecision] = useState<NonNullable<BirthInput["timePrecision"]>>("exact");
  const [lunarYear, setLunarYear] = useState(1990);
  const [lunarMonth, setLunarMonth] = useState(5);
  const [lunarDay, setLunarDay] = useState(23);
  const [leap, setLeap] = useState(false);
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [result, setResult] = useState<LocalChartResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [privacyNote, setPrivacyNote] = useState("");
  const [timeBasis, setTimeBasis] = useState<ChartConfig["timeBasis"]>("true_solar");
  const [dayBoundary, setDayBoundary] = useState<ChartConfig["dayBoundary"]>("midnight_00");
  const [qiyunMethod, setQiyunMethod] = useState<ChartConfig["qiyunMethod"]>("precise_seconds");
  const [feedback, setFeedback] = useState<Record<string, "matches" | "does_not_match" | "cannot_judge">>({});

  function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const base = { gender, localTime: time, timePrecision, birthPlaceText: place.displayName, countryCode: place.countryCode ?? "", latitude: place.latitude, longitude: place.longitude, timeZone: place.timeZone };
    const birth: BirthInput = calendar === "gregorian"
      ? { ...base, calendarType: "gregorian", localDate: date }
      : { ...base, calendarType: "lunar", lunarYear, lunarMonth, lunarDay, isLeapMonth: leap };
    try {
      const config = { timeBasis, dayBoundary, qiyunMethod };
      const data = createLocalChartResult(birth, config);
      setResult(data);
      setFeedback({});
      setTimeout(() => document.querySelector("#chart-result")?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "排盘失败"); }
    finally { setLoading(false); }
  }

  function saveLocally() {
    if (!result) return;
    localStorage.setItem("bazi.relationship.report.v1", JSON.stringify(result));
    setPrivacyNote("已保存到这台设备的浏览器中；没有上传额外身份信息。");
  }

  function deleteLocally() {
    localStorage.removeItem("bazi.relationship.report.v1");
    setResult(null);
    setPrivacyNote("本机保存的出生资料和报告已删除。");
  }

  function exportReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bazi-report-${result.chart.normalizedGregorianInput.localDate}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setPrivacyNote("报告已导出为本地 JSON 文件；系统不会自动生成公开链接。");
  }

  function exportFeedback() {
    if (!result || !Object.keys(feedback).length) return;
    const payload = {
      schemaVersion: "relationship-feedback-v1",
      reportSchemaVersion: result.report.schemaVersion,
      ruleSetVersion: result.report.metadata.ruleSetVersion,
      exportedAt: new Date().toISOString(),
      privacy: "不包含出生时间、地点、四柱或身份信息；反馈不作为人工命理真值标签。",
      items: result.report.chapters.filter((chapter: any) => feedback[chapter.id]).map((chapter: any) => ({
        conclusionId: chapter.id,
        evidenceRuleIds: chapter.evidence.ruleIds,
        rating: feedback[chapter.id],
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bazi-report-feedback.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setPrivacyNote("反馈已导出，不包含出生时间、地点或四柱；它不会自动修改规则。");
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">见字</span><span className="brand-sub">四柱关系实验室</span></div><span className="top-note">时间可追溯 · 规则有版本 · 结果可复核</span></header>
    <section className="hero form-hero">
      <div className="form-heading"><div className="eyebrow">BAZI RELATIONSHIP ATLAS</div><h1>建立命盘</h1><p>输入出生时空，生成可追溯的四柱、大运与流年关系。</p></div>
      <form className="form-card paipan-form" onSubmit={submit}>
        <div className="identity-row"><label htmlFor="person-name">姓名</label><input id="person-name" value={personName} onChange={event => setPersonName(event.target.value)} maxLength={30} placeholder="选填，用于本次报告显示" /></div>
        <div className="paipan-row"><div className="row-label">性别</div><div className="gender-pills"><button type="button" className={gender === "male" ? "active" : ""} onClick={() => setGender("male")}><i />男</button><button type="button" className={gender === "female" ? "active" : ""} onClick={() => setGender("female")}><i />女</button></div><div className="segmented calendar-tabs"><button type="button" className={calendar === "gregorian" ? "active" : ""} onClick={() => setCalendar("gregorian")}>公历</button><button type="button" className={calendar === "lunar" ? "active" : ""} onClick={() => setCalendar("lunar")}>农历</button></div></div>
        <div className="field-grid paipan-fields">
          {calendar === "gregorian" ? <div className="field"><label>出生日期</label><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></div> : <><div className="field"><label>农历年</label><input type="number" min="1900" max="2100" value={lunarYear} onChange={e => setLunarYear(+e.target.value)} /></div><div className="field"><label>农历月 / 日</label><div className="place-row"><input type="number" min="1" max="12" value={lunarMonth} onChange={e => setLunarMonth(+e.target.value)} /><input type="number" min="1" max="30" value={lunarDay} onChange={e => setLunarDay(+e.target.value)} /></div><label><input type="checkbox" checked={leap} onChange={e => setLeap(e.target.checked)} /> 闰月</label></div></>}
          <div className="field"><label>出生时间</label><input type="time" required value={time} onChange={e => setTime(e.target.value)} /><select aria-label="出生时间精度" value={timePrecision} onChange={e => setTimePrecision(e.target.value as NonNullable<BirthInput["timePrecision"]>)}><option value="exact">准确到分钟</option><option value="approximate">大约时间</option><option value="unknown">时间不确定</option></select></div>
          <div className="field full location-field"><label>出生地点</label><button className="location-trigger" type="button" onClick={() => setPlacePickerOpen(true)}><span>{place.displayName}</span><small>{place.timeZone}</small><b>选择地区 ›</b></button><div className="place-confirm">北纬 {place.latitude.toFixed(4)} · 东经 {place.longitude.toFixed(4)} · {place.countryCode === "CN" ? "北京时间" : "当地历史时区"}</div></div>
          <div className="field full"><label>排盘口径</label><div className="field-grid"><select aria-label="时间口径" value={timeBasis} onChange={e => setTimeBasis(e.target.value as ChartConfig["timeBasis"])}><option value="true_solar">真太阳时（推荐）</option><option value="local_mean_solar">地方平太阳时</option><option value="civil">民用时间</option></select><select aria-label="换日口径" value={dayBoundary} onChange={e => setDayBoundary(e.target.value as ChartConfig["dayBoundary"])}><option value="midnight_00">零点换日（推荐）</option><option value="zi_initial_23">23 点换日</option></select><select aria-label="起运算法" value={qiyunMethod} onChange={e => setQiyunMethod(e.target.value as ChartConfig["qiyunMethod"])}><option value="precise_seconds">交节秒数精确折算（推荐）</option><option value="precise_minutes">旧版分钟折算</option><option value="rounded_shichen">时辰取整折算</option></select></div></div>
        </div><button className="submit paipan-submit" disabled={loading}>{loading ? "正在校正时空…" : "开始排盘"}</button><p className="form-privacy">排盘和文案均在当前浏览器本地完成；出生资料不会发送到服务器，除非主动保存也不会写入浏览器。</p>{error && <div className="error">{error}</div>}</form>
    </section>
    <PlacePicker key={`${place.displayName}-${placePickerOpen}`} open={placePickerOpen} value={place} onClose={() => setPlacePickerOpen(false)} onConfirm={setPlace} />
    {result ? <ChartResult result={result} personName={personName.trim() || "未命名命盘"} genderLabel={gender === "male" ? "男" : "女"} calendarLabel={calendar === "gregorian" ? `公历 ${date} ${time}` : `农历 ${lunarYear}年${leap ? "闰" : ""}${lunarMonth}月${lunarDay}日 ${time}`} place={place} birthLabel={`${calendar === "gregorian" ? date : `农历${lunarYear}年${lunarMonth}月${lunarDay}日` } ${time} · ${place.displayName}`} feedback={feedback} setFeedback={setFeedback} onSave={saveLocally} onDelete={deleteLocally} onExport={exportReport} onExportFeedback={exportFeedback} privacyNote={privacyNote} /> : <section className="results"><div className="empty-state">填写出生资料后，在这里展开四柱、原局关系、大运与流年。{privacyNote && <div className="privacy-note">{privacyNote}</div>}</div></section>}
  </main>;
}
