import { parse } from "csv-parse/sync";

export const CURRENT_RULE_HIT_HEADERS = Object.freeze(["hit_id", "case_id", "set_split", "rule_id", "模块", "规则名称", "命中时点", "预测角色", "核验结果", "匹配分", "反例强度", "安全关键", "event_ids", "纳入", "备注"]);

export function parseCurrentRuleHitCsv(csv: string): readonly Readonly<Record<string, string>>[] {
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const headerLine = csv.replace(/^\uFEFF/u, "").split(/\r?\n/u)[0] ?? "";
  const headers = headerLine.split(",");
  if (headers.length === 17) throw new Error("legacy 17-column calibration template is rejected; use the authoritative 15-column contract");
  if (JSON.stringify(headers) !== JSON.stringify(CURRENT_RULE_HIT_HEADERS)) throw new Error("calibration template headers do not match the authoritative 15-column contract");
  return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}

export function serializeCurrentRuleHitCsv(rows: readonly Readonly<Record<string, string>>[]): string {
  const escape = (value: string) => /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return `${CURRENT_RULE_HIT_HEADERS.join(",")}\n${rows.map((row) => CURRENT_RULE_HIT_HEADERS.map((header) => escape(row[header] ?? "")).join(",")).join("\n")}${rows.length ? "\n" : ""}`;
}
