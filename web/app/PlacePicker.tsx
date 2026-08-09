"use client";

import { useEffect, useMemo, useState } from "react";
import { getPCA } from "lcn";
import districtCoordinates from "./data/china-district-coordinates.json";

export type PlaceChoice = { displayName: string; countryCode: string | null; province?: string; city?: string; district?: string; latitude: number; longitude: number; timeZone: string };
type DivisionNode = { code: string; name: string; children?: DivisionNode[] };
type CoordinateRecord = Record<string, [number, number, "district" | "city"]>;

const DOMESTIC_HIERARCHY = getPCA({ inland: true }) as DivisionNode[];
const DOMESTIC_COORDINATES = districtCoordinates as unknown as CoordinateRecord;

function domesticChoice(province: DivisionNode, city: DivisionNode, district: DivisionNode): PlaceChoice {
  const [latitude, longitude] = DOMESTIC_COORDINATES[district.code] ?? [35.8617, 104.1954, "city"];
  return {
    displayName: `中国 ${province.name} ${city.name} ${district.name}`,
    countryCode: "CN",
    province: province.name,
    city: city.name,
    district: district.name,
    latitude,
    longitude,
    timeZone: "Asia/Shanghai",
  };
}

const DOMESTIC_SEARCH_INDEX = DOMESTIC_HIERARCHY.flatMap((province) =>
  (province.children ?? []).flatMap((city) =>
    (city.children ?? []).map((district) => domesticChoice(province, city, district)),
  ),
);

const QUICK_OVERSEAS: PlaceChoice[] = [
  { displayName: "新加坡 新加坡", countryCode: "SG", latitude: 1.3521, longitude: 103.8198, timeZone: "Asia/Singapore" },
  { displayName: "日本 东京都", countryCode: "JP", latitude: 35.6762, longitude: 139.6503, timeZone: "Asia/Tokyo" },
  { displayName: "英国 伦敦", countryCode: "GB", latitude: 51.5074, longitude: -0.1278, timeZone: "Europe/London" },
  { displayName: "美国 纽约", countryCode: "US", latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
  { displayName: "澳大利亚 悉尼", countryCode: "AU", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney" },
];

function pathParts(place: PlaceChoice) {
  if (place.countryCode === "CN") return [place.province || "请选择省份", place.city || "请选择城市", place.district || "请选择区县"];
  const parts = place.displayName.split(/[,，]\s*|\s+/u).filter(Boolean);
  return [parts[0] ?? "国家", parts.at(-1) ?? "地区"];
}

function gmtLabel(timeZone: string) {
  try { return new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find(item => item.type === "timeZoneName")?.value ?? timeZone; }
  catch { return timeZone; }
}

export function PlacePicker({ open, value, onClose, onConfirm }: { open: boolean; value: PlaceChoice; onClose(): void; onConfirm(place: PlaceChoice): void }) {
  const [mode, setMode] = useState<"domestic" | "overseas">(value.countryCode === "CN" ? "domestic" : "overseas");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [selected, setSelected] = useState(value);
  const [placeError, setPlaceError] = useState("");
  const [beijingPreview, setBeijingPreview] = useState(false);
  const [provinceCode, setProvinceCode] = useState(() => DOMESTIC_HIERARCHY.find(item => item.name === value.province)?.code ?? DOMESTIC_HIERARCHY[0]?.code ?? "");
  const [cityCode, setCityCode] = useState(() => DOMESTIC_HIERARCHY.flatMap(item => item.children ?? []).find(item => item.name === value.city)?.code ?? "");
  const [districtCode, setDistrictCode] = useState(() => DOMESTIC_HIERARCHY.flatMap(item => item.children ?? []).flatMap(item => item.children ?? []).find(item => item.name === value.district)?.code ?? "");

  const province = useMemo(() => DOMESTIC_HIERARCHY.find(item => item.code === provinceCode) ?? DOMESTIC_HIERARCHY.find(item => item.name === selected.province) ?? DOMESTIC_HIERARCHY[0], [provinceCode, selected.province]);
  const cities = province?.children ?? [];
  const city = cities.find(item => item.code === cityCode) ?? cities.find(item => item.name === selected.city) ?? cities[0];
  const districts = city?.children ?? [];
  const district = districts.find(item => item.code === districtCode) ?? districts[0];
  const parts = useMemo(() => pathParts(selected), [selected]);
  const displayParts = mode === "domestic" ? [province?.name ?? "请选择省份", city?.name ?? "请选择城市", district?.name ?? "请选择区县"] : parts;
  const domesticSelectionResolved = mode !== "domestic" || results.length > 0 || (selected.province === province?.name && selected.city === city?.name && selected.district === district?.name);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, value, onClose]);

  function search() {
    if (query.trim().length < 2) return;
    setPlaceError("");
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    const source = mode === "domestic" ? DOMESTIC_SEARCH_INDEX : QUICK_OVERSEAS;
    const matches = source.filter(place => place.displayName.toLocaleLowerCase("zh-CN").includes(keyword)).slice(0, 100);
    setResults(matches);
    if (!matches.length) setPlaceError(mode === "domestic" ? "本地行政区数据中没有匹配结果。" : "离线版未收录该海外地点，可选择接近城市后手动修改经纬度和时区。");
  }

  function selectDomestic(provinceItem: DivisionNode, cityItem: DivisionNode, districtItem: DivisionNode) {
    setProvinceCode(provinceItem.code);
    setCityCode(cityItem.code);
    setDistrictCode(districtItem.code);
    setSelected(domesticChoice(provinceItem, cityItem, districtItem));
    setPlaceError("");
  }

  function chooseProvince(item: DivisionNode) {
    const nextCity = item.children?.[0];
    const nextDistrict = nextCity?.children?.[0];
    if (nextCity && nextDistrict) selectDomestic(item, nextCity, nextDistrict);
  }

  function chooseCity(item: DivisionNode) {
    const nextDistrict = item.children?.[0];
    if (province && nextDistrict) selectDomestic(province, item, nextDistrict);
  }

  function chooseDistrict(item: DivisionNode) {
    if (!province || !city) return;
    selectDomestic(province, city, item);
  }

  if (!open) return null;
  return <div className="place-modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="place-modal" role="dialog" aria-modal="true" aria-labelledby="place-modal-title">
      <div className="place-modal-top"><div className="place-tabs" id="place-modal-title"><button type="button" className={mode === "domestic" ? "active" : ""} onClick={() => { setMode("domestic"); setResults([]); }}>国内</button><button type="button" className={mode === "overseas" ? "active" : ""} onClick={() => { setMode("overseas"); setResults([]); }}>海外</button></div><button className="modal-close" type="button" aria-label="关闭地点选择" onClick={onClose}>×</button></div>
      <div className="place-search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); search(); } }} placeholder={mode === "domestic" ? "搜索全国城市及地区" : "搜索已收录的海外城市"} /><button type="button" onClick={search}>搜索</button></div>
      {mode === "domestic" && !results.length ? <><div className="place-columns domestic"><div>省份</div><div>城市</div><div>区县</div></div><div className="domestic-cascader" aria-label="中国省市区县选择">
        <div className="division-column">{DOMESTIC_HIERARCHY.map(item => <button type="button" className={item.code === province?.code ? "selected" : ""} key={item.code} onClick={() => chooseProvince(item)}>{item.name}</button>)}</div>
        <div className="division-column">{cities.map(item => <button type="button" className={item.code === city?.code ? "selected" : ""} key={item.code} onClick={() => chooseCity(item)}>{item.name}</button>)}</div>
        <div className="division-column">{districts.map(item => <button type="button" className={item.code === districtCode ? "selected" : ""} key={item.code} onClick={() => chooseDistrict(item)}>{item.name}</button>)}</div>
      </div></> : <><div className={`place-columns ${mode}`}><div>{mode === "domestic" ? "省市区搜索结果" : "国家"}</div><div>{mode === "domestic" ? "坐标" : "地区"}</div>{mode === "domestic" && <div><button className="back-to-cascader" type="button" onClick={() => setResults([])}>返回三级选择</button></div>}</div><div className="place-options" aria-label="地点候选">{(results.length ? results : QUICK_OVERSEAS).map(place => <button type="button" className={place.displayName === selected.displayName ? "selected" : ""} key={`${place.displayName}-${place.latitude}`} onClick={() => setSelected(place)}>{mode === "overseas" && <strong>{gmtLabel(place.timeZone)}</strong>}<span>{place.displayName}</span><small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></button>)}</div></>}
      <div className={`place-selection ${mode}`}>{displayParts.map((part, index) => <strong key={`${part}-${index}`}>{part}</strong>)}</div>
      {placeError && <p className="place-error">{placeError}</p>}
      <div className="place-coordinate-editor"><label>纬度<input type="number" min="-90" max="90" step="0.000001" value={selected.latitude} onChange={event => setSelected(current => ({ ...current, latitude: Number(event.target.value) }))} /></label><label>经度<input type="number" min="-180" max="180" step="0.000001" value={selected.longitude} onChange={event => setSelected(current => ({ ...current, longitude: Number(event.target.value) }))} /></label>{mode === "overseas" && <label>时区<input value={selected.timeZone} onChange={event => setSelected(current => ({ ...current, timeZone: event.target.value }))} placeholder="Asia/Singapore" /></label>}</div>
      {mode === "overseas" && <label className="beijing-switch"><span>换算北京时间 <small>（仅辅助显示）</small></span><input type="checkbox" checked={beijingPreview} onChange={event => setBeijingPreview(event.target.checked)} /><i /></label>}
      <button className="place-confirm-button" type="button" disabled={!domesticSelectionResolved || !Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude)} onClick={() => { onConfirm(selected); onClose(); }}>确定</button>
      <p className="place-footnote">{mode === "overseas" ? `当前地点：${selected.timeZone}${beijingPreview ? " · 将同时显示北京时间参考" : ""}` : `本地行政区坐标：${selected.latitude.toFixed(4)}, ${selected.longitude.toFixed(4)}（可手动校正）`}</p>
    </section>
  </div>;
}
