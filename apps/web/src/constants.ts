import type { RealityGateDraft } from "./types";

export const REALITY_GATES: readonly Omit<RealityGateDraft, "status" | "note">[] = [
  { id: "RG01", label: "安全、同意与尊重" },
  { id: "RG02", label: "关系意图与承诺" },
  { id: "RG03", label: "价值观与人生目标" },
  { id: "RG04", label: "时间、地点与生活节奏" },
  { id: "RG05", label: "金钱、资源与劳动" },
  { id: "RG06", label: "家庭、生育与照护责任" },
  { id: "RG07", label: "身体、亲密、隐私与健康" },
  { id: "RG08", label: "冲突、修复与学习意愿" },
];

export const STATUS_LABELS: Readonly<Record<string, string>> = {
  complete: "完整", provisional: "暂定", limited: "受限", dependency_pending: "等待依赖", stop: "已停止",
  supported: "有支持", conditional: "有条件", candidate: "候选", contradicted: "有反证", unknown: "未知", not_assessed: "未评估", stopped: "已停止",
  pass: "通过", fail: "未通过", standard: "标准", safety_stop: "安全停止", insufficient_data: "资料不足", core_gate_stop: "核心闸门停止",
  high: "高", medium_high: "中高", medium: "中", medium_low: "中低", low: "低",
  yang: "阳", yin: "阴",
  strong_candidate: "偏强候选", balanced_candidate: "均衡候选", weak_candidate: "偏弱候选",
  cold: "偏寒", hot: "偏热", neutral: "中和", humid: "偏湿", dry: "偏燥",
  secondary_candidate: "辅助候选", primary_candidate: "主要候选",
  multi_round: "多轮确认", single_round: "单轮确认", pressure: "压力态", steady: "稳定态", repair: "修复态", turning_point: "转折态",
  unconfirmed: "未经现实核验", mixed_evidence: "证据混合", observed_pattern: "已观察重复模式",
  PAUSE_WITHOUT_WITHDRAWAL_INFERENCE: "暂停，但不把暂停推断为撤回关系",
  NAME_THE_ACTIVE_CHANNEL_AND_NEED: "说清当前沟通通道与具体需要",
  MAKE_ONE_OBSERVABLE_REQUEST: "提出一个可观察、可回应的请求",
  CONFIRM_RESPONSE_AND_BOUNDARY: "确认回应与双方边界",
  RESUME_OR_RENEGOTIATE: "恢复沟通，或重新协商安排",
  MINIMUM_EFFECTIVE_DOSE: "只采用最低有效程度",
  STOP_IF_SECONDARY_IMBALANCE: "出现次生失衡时停止",
  REASSESS_IF_PATTERN_OR_ROUTE_CHANGES: "结构或路径变化时重新评估",
};

export const GRADE_COPY: Readonly<Record<string, { title: string; detail: string }>> = {
  FG0: { title: "停止普通分析", detail: "安全或同意事实优先，当前只呈现必要边界。" },
  FG1: { title: "结构画像", detail: "只基于单盘结构，不代表现实适配。" },
  FG2: { title: "证据有限", detail: "已有现实信息，但关键闸门仍缺失或单方。" },
  FG3: { title: "条件性适配", detail: "现实信息支持部分交集，同时保留失败条件。" },
  FG4: { title: "跨情境稳定", detail: "多种状态下证据一致，仍不是成功概率。" },
};

export const MODULES = [
  { id: "M0", title: "原局结构", note: "静态事实与候选" },
  { id: "M1", title: "吸引入口", note: "偏好信号，不推断对象" },
  { id: "M2", title: "选择机制", note: "准入、流向与确认" },
  { id: "M3", title: "相处惯性", note: "互动通道与修复" },
  { id: "M4", title: "风险链", note: "结构候选需现实核验" },
  { id: "M5", title: "现实适配", note: "闸门、证据与边界" },
] as const;
