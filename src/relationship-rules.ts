import type { RelationshipRule } from "./rule-schema.js";

const source = (section: string) => ({ file: "看盘—情感婚姻.docx", section });
const forbidden = ["注定", "一定婚姻不好", "必然离婚", "克死伴侣"];

export const RELATIONSHIP_RULE_SET_VERSION = "relationship-rules-v1-draft";

export const RELATIONSHIP_RULE_THEMES = [
  { id: "spouse-star-by-gender", title: "男命财星、女命官杀", ruleIds: ["relationship.spouse-star.present"] },
  { id: "spouse-star-presence-root", title: "夫妻星有无、透藏和通根", ruleIds: ["relationship.spouse-star.hidden-only", "relationship.spouse-star.absent"] },
  { id: "spouse-star-direct-indirect", title: "正偏夫妻星", ruleIds: ["relationship.spouse-star.mixed"] },
  { id: "strength-combination", title: "身强弱与夫妻星强弱组合", ruleIds: ["relationship.review-required.daymaster-strength", "relationship.review-required.spouse-star-strength"] },
  { id: "spouse-star-position", title: "夫妻星位置", ruleIds: ["relationship.spouse-star.position.year", "relationship.spouse-star.position.month", "relationship.spouse-star.position.day", "relationship.spouse-star.position.hour"] },
  { id: "month-mode", title: "月令十神恋爱模式", ruleIds: ["relationship.review-required.month-mode.direct-resource"] },
  { id: "love-expression", title: "食神、伤官表达爱方式", ruleIds: ["relationship.love-expression.food-god", "relationship.love-expression.hurting-officer"] },
  { id: "spouse-palace-ten-god", title: "夫妻宫十神和喜忌", ruleIds: ["relationship.review-required.spouse-palace-ten-god-favorable"] },
  { id: "spouse-palace-relations", title: "夫妻宫刑冲合害", ruleIds: ["relationship.spouse-palace.clash", "relationship.spouse-palace.harm"] },
  { id: "star-palace-relations", title: "夫妻星与夫妻宫生克合冲刑害", ruleIds: ["relationship.review-required.spouse-star-palace-relations"] },
  { id: "peach-blossom", title: "桃花位置、旺衰及组合", ruleIds: ["relationship.peach-blossom.position", "relationship.review-required.peach-blossom-strength-combinations"] },
  { id: "output-spouse-star", title: "食伤生财、食伤制官", ruleIds: ["relationship.review-required.output-spouse-star-combinations"] },
  { id: "peer-spouse-star", title: "比劫夺财、比劫夺官", ruleIds: ["relationship.review-required.peer-spouse-star-combinations"] },
  { id: "mixed-spouse-stars", title: "官杀混杂、财星混杂", ruleIds: ["relationship.spouse-star.mixed"] },
  { id: "dayun-trigger", title: "大运引动夫妻星、夫妻宫", ruleIds: ["relationship.review-required.dayun-relationship-trigger"] },
  { id: "annual-trigger", title: "流年引动夫妻星、夫妻宫", ruleIds: ["relationship.review-required.annual-relationship-trigger"] },
] as const;

function reviewRequiredRule(
  id: string,
  title: string,
  topic: string,
  dependency: string,
  section: string,
): RelationshipRule {
  return {
    id,
    version: 1,
    status: "review_required",
    topic,
    title,
    conditions: { all: [{ fact: `research.${dependency}`, operator: "exists" }] },
    enhancers: [],
    reducers: [],
    exclusions: [],
    evidencePriority: 0,
    confidence: "low",
    outputs: {
      tendency: "原始资料包含该判断主题，但依赖条件尚未冻结。",
      positive: "保留来源和原子主题，供人工逐条定义与审核。",
      risk: "当前不得进入生产报告，也不得补全具体断语。",
      advice: "先完成依赖算法、反例和边界样本审核。",
    },
    languageConstraints: { forbidden },
    dependencies: [`research.${dependency}`],
    source: source(section),
  };
}

export const RELATIONSHIP_RULES: RelationshipRule[] = [
  {
    id: "relationship.spouse-star.present", version: 1, status: "approved", topic: "spouse_star", title: "夫妻星出现",
    conditions: { all: [{ fact: "relationship.spouseStar.count", operator: "greater_than", value: 0 }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 70, confidence: "medium",
    outputs: { tendency: "较容易把伴侣与长期关系纳入人生关注。", positive: "对关系对象的感受和需求较容易被自己觉察。", risk: "出现不等于关系就会发生，仍需结合现实互动。", advice: "把关注转化为明确、可沟通的择偶标准。" }, languageConstraints: { forbidden }, dependencies: ["relationship.spouseStar"], source: source("看夫妻星—有无"),
  },
  {
    id: "relationship.spouse-star.hidden-only", version: 1, status: "approved", topic: "spouse_star", title: "夫妻星只藏不透",
    conditions: { all: [{ fact: "relationship.spouseStar.hiddenCount", operator: "greater_than", value: 0 }, { fact: "relationship.spouseStar.visibleCount", operator: "equals", value: 0 }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 68, confidence: "medium",
    outputs: { tendency: "感情需求可能更慢热或不张扬。", positive: "关系更可能在持续接触中逐渐建立。", risk: "被动等待可能让机会不易被识别。", advice: "在安全的节奏里主动表达兴趣和边界。" }, languageConstraints: { forbidden }, dependencies: ["relationship.spouseStar"], source: source("看夫妻星—透藏通根"),
  },
  {
    id: "relationship.spouse-star.absent", version: 1, status: "approved", topic: "spouse_star", title: "原局夫妻星不现",
    conditions: { all: [{ fact: "relationship.spouseStar.count", operator: "equals", value: 0 }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 65, confidence: "low",
    outputs: { tendency: "原局中伴侣主题不突出，可能更依赖后续环境触发。", positive: "可以更自主地厘清关系是否符合自身需要。", risk: "这不代表没有婚姻，也不能据此判断婚期。", advice: "不要用单一命盘信号替代真实的认识与选择。" }, languageConstraints: { forbidden }, dependencies: ["relationship.spouseStar"], source: source("看夫妻星—有无"),
  },
  ...(["year", "month", "day", "hour"] as const).map((position, index): RelationshipRule => ({
    id: `relationship.spouse-star.position.${position}`, version: 1, status: "approved", topic: "spouse_star_position", title: `夫妻星位于${position}柱`,
    conditions: { all: [{ fact: "relationship.spouseStar.positions", operator: "includes", value: position }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 62, confidence: "low",
    outputs: {
      tendency: ["缘分线索可能更多来自早年环境、家庭或既有人际圈。", "缘分线索可能更多来自学习、工作或社会活动。", "关系更可能从日常近距离接触与长期相处中发展。", "缘分线索可能更多在人生后期、兴趣圈或成熟后的环境中出现。"][index]!,
      positive: "这提供了一种认识场景的观察角度。", risk: "位置不能单独预测具体对象或事件。", advice: "把它当作拓展现实社交场景的提示，而非限制。",
    }, languageConstraints: { forbidden }, dependencies: ["relationship.spouseStar"], source: source("夫妻星的位置看缘分出现在哪"),
  })),
  {
    id: "relationship.spouse-palace.clash", version: 1, status: "approved", topic: "spouse_palace", title: "夫妻宫见冲",
    conditions: { all: [{ fact: "relationship.spousePalace.relations", operator: "includes", value: "branch_clash" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 72, confidence: "medium",
    outputs: { tendency: "长期相处模式可能较容易受到环境变化或双方节奏差异影响。", positive: "变化也可能推动双方重新协商更合适的相处方式。", risk: "在压力期容易放大距离感或调整需求。", advice: "变化发生时，先区分外部压力与关系本身的问题。" }, languageConstraints: { forbidden }, dependencies: ["relations"], source: source("看夫妻宫—日支刑冲合害"),
  },
  {
    id: "relationship.spouse-palace.harm", version: 1, status: "approved", topic: "spouse_palace", title: "夫妻宫见害",
    conditions: { all: [{ fact: "relationship.spousePalace.relations", operator: "includes", value: "branch_harm" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 66, confidence: "low",
    outputs: { tendency: "相处中可能更需要留意没有直接说出的误解或不协调。", positive: "及早澄清隐含期待，有助于减少猜测。", risk: "把猜测当事实会增加隔阂。", advice: "用具体事件和感受沟通，避免替对方下结论。" }, languageConstraints: { forbidden }, dependencies: ["relations"], source: source("看夫妻宫—日支刑冲合害"),
  },
  {
    id: "relationship.peach-blossom.position", version: 1, status: "approved", topic: "peach_blossom", title: "命局见桃花",
    conditions: { all: [{ fact: "relationship.peachBlossom.positionCount", operator: "greater_than", value: 0 }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 35, confidence: "low",
    outputs: { tendency: "人际互动或吸引力是值得观察的辅助信号。", positive: "较容易在相应生活场景中产生互动机会。", risk: "桃花不能单独判断关系数量、质量或结果。", advice: "比吸引力更重要的是边界、价值观与长期行动。" }, languageConstraints: { forbidden }, dependencies: ["derived.peachBlossom"], source: source("桃花的基本含义与位置"),
  },
  {
    id: "relationship.spouse-star.mixed", version: 1, status: "approved", topic: "spouse_star", title: "正偏夫妻星并见",
    conditions: { all: [{ fact: "relationship.spouseStar.mixed", operator: "equals", value: true }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 58, confidence: "low",
    outputs: { tendency: "命盘中同时出现正偏夫妻星，可能会注意到不同类型的吸引特质。", positive: "对关系类型的感受维度可能更丰富。", risk: "并见不等于感情复杂，也不能据此判断关系数量。", advice: "把短期吸引和长期适配分别写成具体标准。" }, languageConstraints: { forbidden }, dependencies: ["relationship.spouseStar"], source: source("夫妻星—正偏与混杂"),
  },
  {
    id: "relationship.love-expression.food-god", version: 1, status: "approved", topic: "love_expression", title: "食神表达方式",
    conditions: { all: [{ fact: "relationship.loveExpression.tenGodsPresent", operator: "includes", value: "食神" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 55, confidence: "low",
    outputs: { tendency: "表达在意时，可能更容易使用陪伴、照顾或营造舒适感的方式。", positive: "温和而持续的行动有助于关系稳定。", risk: "遇到冲突时可能需要更主动地说出问题。", advice: "除了照顾对方，也练习直接表达自己的需要。" }, languageConstraints: { forbidden }, dependencies: ["relationship.loveExpression"], source: source("食伤—我如何表达爱"),
  },
  {
    id: "relationship.love-expression.hurting-officer", version: 1, status: "approved", topic: "love_expression", title: "伤官表达方式",
    conditions: { all: [{ fact: "relationship.loveExpression.tenGodsPresent", operator: "includes", value: "伤官" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 55, confidence: "low",
    outputs: { tendency: "表达在意时，可能更看重观点交流、理解感和精神回应。", positive: "清晰表达能帮助双方更快理解彼此。", risk: "标准较高时，表达容易被听成挑剔。", advice: "提出问题时，同时说清期待和可接受的调整。" }, languageConstraints: { forbidden }, dependencies: ["relationship.loveExpression"], source: source("食伤—我如何表达爱"),
  },
  ...(["branch_combine", "branch_punishment", "branch_self_punishment", "branch_break"] as const).map((kind): RelationshipRule => ({
    id: `relationship.spouse-palace.${kind.replace("branch_", "")}`, version: 1, status: "approved", topic: "spouse_palace", title: `夫妻宫作用：${kind}`,
    conditions: { all: [{ fact: "relationship.spousePalace.relations", operator: "includes", value: kind }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: kind === "branch_combine" ? 61 : 64, confidence: "low",
    outputs: kind === "branch_combine"
      ? { tendency: "长期关系中可能较看重连接感，也较容易受伴侣互动影响。", positive: "愿意建立连接有助于形成共同生活节奏。", risk: "连接较强时也要保留个人边界。", advice: "定期确认双方各自需要的靠近与空间。" }
      : kind === "branch_break"
        ? { tendency: "相处模式中可能出现计划被细节打断或节奏重新调整的情况。", positive: "及时修补小问题能避免累积。", risk: "忽略反复的小摩擦会削弱信任。", advice: "对重复发生的小问题约定具体处理方式。" }
        : { tendency: "长期相处中可能较容易重复某类摩擦或内耗。", positive: "看见重复模式后，双方有机会建立新的回应方式。", risk: "只争对错可能让同一问题循环出现。", advice: "记录触发点、各自反应和真正需要，再讨论改变。" },
    languageConstraints: { forbidden }, dependencies: ["relations"], source: source("看夫妻宫—日支刑冲合害"),
  })),
  ...([ ["正印", "direct-resource"], ["偏印", "indirect-resource"], ["比肩", "peer"], ["劫财", "rob-wealth"], ["正财", "direct-wealth"], ["偏财", "indirect-wealth"], ["正官", "direct-officer"], ["七杀", "seven-killings"] ] as const).map(([tenGod, slug]): RelationshipRule => ({
    id: `relationship.review-required.month-mode.${slug}`, version: 1, status: "review_required", topic: "month_mode", title: `待审核：月令${tenGod}恋爱模式`,
    conditions: { all: [{ fact: "relationship.monthMode.mainHiddenTenGod", operator: "equals", value: tenGod }, { fact: "research.favorable-unfavorable", operator: "exists" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 0, confidence: "low",
    outputs: { tendency: "原始资料将此模式按旺衰喜忌拆分，当前不能省略条件直接判断。", positive: "保留月令事实供人工审核。", risk: "未审核前不得进入生产报告。", advice: "暂不生成个体化结论。" }, languageConstraints: { forbidden }, dependencies: ["research.favorable-unfavorable", "relationship.monthMode"], source: source(`月令${tenGod}恋爱模式表`),
  })),
  ...(["daymaster-strength", "spouse-star-strength", "favorable-unfavorable", "combination-transformation"] as const).map((dependency): RelationshipRule => ({
    id: `relationship.review-required.${dependency}`, version: 1, status: "review_required", topic: "research_dependency", title: `待审核：${dependency}`,
    conditions: { all: [{ fact: `research.${dependency}`, operator: "exists" }] }, enhancers: [], reducers: [], exclusions: [], evidencePriority: 0, confidence: "low",
    outputs: { tendency: "该结论依赖尚未冻结的旺衰或制化算法。", positive: "保留资料来源，待算法与人工审核完成后再启用。", risk: "当前不得进入生产报告。", advice: "暂不输出个体判断。" }, languageConstraints: { forbidden }, dependencies: [`research.${dependency}`], source: source("身强弱、喜忌、旺衰与制化相关表格"),
  })),
  reviewRequiredRule("relationship.review-required.spouse-palace-ten-god-favorable", "待审核：夫妻宫十神、旺衰与喜忌", "spouse_palace_ten_god", "spouse-palace-strength-favorable", "二、看夫妻宫—夫妻宫十神旺衰喜忌"),
  reviewRequiredRule("relationship.review-required.spouse-star-palace-relations", "待审核：夫妻星与夫妻宫生克合冲刑害", "spouse_star_palace", "spouse-star-palace-relations", "夫妻星与夫妻宫的关系"),
  reviewRequiredRule("relationship.review-required.peach-blossom-strength-combinations", "待审核：桃花旺衰及组合", "peach_blossom", "peach-blossom-strength-favorable", "桃花的基本含义—旺衰、夫妻星、夫妻宫与十神组合"),
  reviewRequiredRule("relationship.review-required.output-spouse-star-combinations", "待审核：食伤生财与食伤制官", "ten_god_combination", "output-spouse-star-strength-favorable", "十神组合—食伤生财、食伤制官"),
  reviewRequiredRule("relationship.review-required.peer-spouse-star-combinations", "待审核：比劫夺财与比劫夺官", "ten_god_combination", "peer-spouse-star-strength-favorable", "十神组合—比劫夺财、比劫夺官"),
  reviewRequiredRule("relationship.review-required.dayun-relationship-trigger", "待审核：大运引动夫妻星与夫妻宫", "relationship_timing", "dayun-trigger-favorable", "大运引动夫妻星、夫妻宫"),
  reviewRequiredRule("relationship.review-required.annual-relationship-trigger", "待审核：流年引动夫妻星与夫妻宫", "relationship_timing", "annual-trigger-favorable", "流年引动夫妻星、夫妻宫"),
];
