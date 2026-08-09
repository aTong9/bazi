export function formatTimeZoneLabel(timeZone: string, countryCode?: string | null) {
  if (countryCode === "CN") return "中国标准时间（UTC+8）";
  return `${timeZone}（当地时区）`;
}
