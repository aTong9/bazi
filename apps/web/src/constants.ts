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

const M5_REASON_LABELS: Readonly<Record<string, string>> = {
  NO_CONCRETE_PARTNER_EVIDENCE: "尚无具体关系对象的现实证据，当前只发布结构画像。",
  SINGLE_CHART_CAP_FG1: "单盘模式的证据等级上限为 FG1。",
  SAFETY_STOP: "安全或同意闸门未通过，停止普通适配分析。",
  SAFETY_OVERRIDES_ALL: "安全事实优先于所有结构候选和普通适配结论。",
  CORE_REALITY_GATE_FAILED: "至少一道核心现实闸门未通过。",
  CORE_GATE_CAP_FG2: "核心现实闸门未通过时，证据等级不高于 FG2。",
  CORE_REALITY_GATE_UNKNOWN: "仍有核心现实闸门缺少可核验事实。",
  EVIDENCE_CAP_FG2: "核心现实证据未闭合，证据等级暂时不高于 FG2。",
  MULTIPLE_CONDITIONAL_GATES: "两道或以上现实闸门仍带有成立条件。",
  CONDITIONAL_CAP_FG3: "多项条件尚未稳定满足，证据等级不高于 FG3。",
  CONDITION_FAILURE_POINT_MUST_BE_PUBLISHED: "存在单项条件闸门，需要保留其失败条件。",
  SINGLE_CONDITIONAL_GATE: "当前结论受一道条件闸门约束。",
  CROSS_STATE_STABLE: "五种跨情境事实均已核验且证据彼此独立。",
  STANDARD_REALITY_SYNTHESIS: "当前等级由八道现实闸门的综合状态形成。",
};

export function m5ReasonLabel(code: string): string { return M5_REASON_LABELS[code] ?? code; }

export const M0_FIELD_LABELS: Readonly<Record<string, string>> = {
  input_validation: "输入完整度与交节核验", scope_boundary: "分析适用范围与模型边界", overall_confidence: "总体置信度与待核查项",
  day_master_and_season: "日主与月令", pillar_element_ten_god_map: "四柱五行与十神映射", roots_and_exposure: "主要根气与透干", natal_structure_summary: "原局结构总览",
  identified_relations: "已成立关系清单", relation_effects: "关系实际效应", pending_or_rejected_relations: "未成立与待定关系",
  element_effective_strength_matrix: "五行有效旺衰矩阵", element_strength_ranking: "五行旺衰排序与主导气势", strength_adjustment_reasons: "关键力量修正原因",
  day_master_strength: "日主旺衰等级", support_side_evidence: "扶身侧核心证据", load_side_evidence: "负荷侧核心证据", adjacent_grade_exclusion: "相邻等级排除与结论置信度",
  ten_god_status_matrix: "十神状态总表", dominant_ten_gods: "主要有力十神及其功能", constrained_or_overused_ten_gods: "受限、失效或过度十神", ten_god_purity: "十神清纯度与混杂",
  established_ten_god_combinations: "已成立十神组合", weak_or_rejected_combinations: "弱成立、不成立与被否决组合", dominant_function_chain: "主导生化、制化与承载功能",
  main_flow_path: "主流通路径", primary_flow_block: "主卡点", secondary_blocks_and_alternatives: "次级卡点与替代路径", bridge_candidates_and_side_effects: "通关候选、有效性与副作用",
  temperature_state: "温度状态", moisture_state: "湿度状态", climate_problem_and_urgency: "主要气候问题与调候紧急度", climate_candidates_and_conflicts: "调候候选、有效性与跨模块冲突",
  pattern_candidates: "格局候选清单与排序", final_pattern: "最终格局与格局状态", pattern_evidence_and_level: "成格证据、清纯度与层次", pattern_failure_factors: "破格因素与破格等级", pattern_rescue_and_alternatives: "救应、有效性与替代候选说明",
  root_disease: "根本主病", secondary_diseases: "次级病及其与主病的关系", primary_and_auxiliary_medicine: "主药、辅助药与药理", medicine_risks: "药力不足、过量、伤格与新病风险",
  five_element_use_matrix: "木火土金水五维用神矩阵", primary_and_auxiliary_use: "主用神与辅助用神", favorable_unfavorable_roles: "喜神、条件性喜神、中性、忌神与仇神", final_structure_summary: "最终结构摘要、条件边界与下游接口",
};

export const MODULES = [
  { id: "M0", title: "原局结构", note: "静态事实与候选" },
  { id: "M1", title: "吸引入口", note: "偏好信号，不推断对象" },
  { id: "M2", title: "选择机制", note: "准入、流向与确认" },
  { id: "M3", title: "相处惯性", note: "互动通道与修复" },
  { id: "M4", title: "风险链", note: "结构候选需现实核验" },
  { id: "M5", title: "现实适配", note: "闸门、证据与边界" },
] as const;
