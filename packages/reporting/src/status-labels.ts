const REPORT_STATUS_LABELS: Readonly<Record<string, string>> = {
  unconfirmed: "未经现实核验",
  mixed_evidence: "证据混合",
  observed_pattern: "已观察到重复模式",
  contradicted: "有反证",
  pass: "通过",
  conditional: "有条件",
  fail: "未通过",
  unknown: "未知",
  not_assessed: "未评估",
};

export function reportStatusLabel(status: string): string {
  return REPORT_STATUS_LABELS[status] ?? status;
}
