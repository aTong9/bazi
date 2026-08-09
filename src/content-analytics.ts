export const CONTENT_ANALYTICS_VERSION = "xiaohongshu-topic-score-v1";

export interface ContentPerformanceRecord {
  title: string;
  firstPublishedAt: string;
  format: string;
  impressions: number;
  views: number;
  coverClickRate: number;
  likes: number;
  comments: number;
  saves: number;
  follows: number;
  shares: number;
  averageWatchSeconds: number;
}

export interface TopicScoreConfig {
  clickRate: { weight: number; target: number };
  engagementRate: { weight: number; target: number };
  saveShareRate: { weight: number; target: number };
  followRate: { weight: number; target: number };
  averageWatchSeconds: { weight: number; target: number };
}

export const DEFAULT_TOPIC_SCORE_CONFIG: Readonly<TopicScoreConfig> = {
  clickRate: { weight: 0.25, target: 0.25 },
  engagementRate: { weight: 0.25, target: 0.1 },
  saveShareRate: { weight: 0.2, target: 0.04 },
  followRate: { weight: 0.2, target: 0.01 },
  averageWatchSeconds: { weight: 0.1, target: 60 },
};

export interface ScoredContentPerformance extends ContentPerformanceRecord {
  analyticsVersion: typeof CONTENT_ANALYTICS_VERSION;
  rates: { engagement: number; saveShare: number; follow: number };
  components: { clickRate: number; engagementRate: number; saveShareRate: number; followRate: number; averageWatchSeconds: number };
  topicScore: number;
}

const HEADERS = ["笔记标题", "首次发布时间", "体裁", "曝光", "观看量", "封面点击率", "点赞", "评论", "收藏", "涨粉", "分享", "人均观看时长"] as const;

function numberCell(value: unknown, header: string, row: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new TypeError(`第 ${row} 行“${header}”必须是非负数字`);
  return value;
}

function isoChineseDate(value: unknown, row: number): string {
  if (typeof value !== "string") throw new TypeError(`第 ${row} 行“首次发布时间”必须是文本`);
  const match = value.match(/^(\d{4})年(\d{2})月(\d{2})日(\d{2})时(\d{2})分(\d{2})秒$/u);
  if (!match) throw new TypeError(`第 ${row} 行“首次发布时间”格式无法识别`);
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
}

/** Import the rectangular values returned by a spreadsheet reader. */
export function importXiaohongshuPerformanceRows(rows: unknown[][]): ContentPerformanceRecord[] {
  const headerIndex = rows.findIndex(row => HEADERS.every(header => row.includes(header)));
  if (headerIndex < 0) throw new Error("找不到小红书数据表头");
  const header = rows[headerIndex]!;
  const column = new Map(header.map((value, index) => [String(value), index]));
  return rows.slice(headerIndex + 1).filter(row => row.some(value => value !== null && value !== "")).map((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const get = (name: typeof HEADERS[number]) => row[column.get(name)!];
    const title = get("笔记标题");
    const format = get("体裁");
    if (typeof title !== "string" || !title.trim()) throw new TypeError(`第 ${rowNumber} 行缺少笔记标题`);
    if (typeof format !== "string" || !format.trim()) throw new TypeError(`第 ${rowNumber} 行缺少体裁`);
    const coverClickRate = numberCell(get("封面点击率"), "封面点击率", rowNumber);
    if (coverClickRate > 1) throw new RangeError(`第 ${rowNumber} 行“封面点击率”必须在 0 到 1 之间`);
    return {
      title: title.trim(), firstPublishedAt: isoChineseDate(get("首次发布时间"), rowNumber), format: format.trim(),
      impressions: numberCell(get("曝光"), "曝光", rowNumber), views: numberCell(get("观看量"), "观看量", rowNumber), coverClickRate,
      likes: numberCell(get("点赞"), "点赞", rowNumber), comments: numberCell(get("评论"), "评论", rowNumber), saves: numberCell(get("收藏"), "收藏", rowNumber),
      follows: numberCell(get("涨粉"), "涨粉", rowNumber), shares: numberCell(get("分享"), "分享", rowNumber), averageWatchSeconds: numberCell(get("人均观看时长"), "人均观看时长", rowNumber),
    };
  });
}

function component(value: number, target: number, weight: number): number {
  if (target <= 0 || weight < 0) throw new RangeError("评分目标必须大于 0，权重不得为负数");
  return Math.min(value / target, 1) * weight * 100;
}

export function scoreContentPerformance(record: ContentPerformanceRecord, config: TopicScoreConfig = DEFAULT_TOPIC_SCORE_CONFIG): ScoredContentPerformance {
  const weightTotal = Object.values(config).reduce((sum, item) => sum + item.weight, 0);
  if (Math.abs(weightTotal - 1) > 1e-9) throw new RangeError("选题评分权重之和必须等于 1");
  const denominator = Math.max(record.views, 1);
  const rates = {
    engagement: (record.likes + record.comments + record.saves + record.shares) / denominator,
    saveShare: (record.saves + record.shares) / denominator,
    follow: record.follows / denominator,
  };
  const components = {
    clickRate: component(record.coverClickRate, config.clickRate.target, config.clickRate.weight),
    engagementRate: component(rates.engagement, config.engagementRate.target, config.engagementRate.weight),
    saveShareRate: component(rates.saveShare, config.saveShareRate.target, config.saveShareRate.weight),
    followRate: component(rates.follow, config.followRate.target, config.followRate.weight),
    averageWatchSeconds: component(record.averageWatchSeconds, config.averageWatchSeconds.target, config.averageWatchSeconds.weight),
  };
  const topicScore = Object.values(components).reduce((sum, value) => sum + value, 0);
  return { ...record, analyticsVersion: CONTENT_ANALYTICS_VERSION, rates, components, topicScore };
}

export function rankContentTopics(records: ContentPerformanceRecord[], config: TopicScoreConfig = DEFAULT_TOPIC_SCORE_CONFIG): ScoredContentPerformance[] {
  return records.map(record => scoreContentPerformance(record, config)).sort((left, right) => right.topicScore - left.topicScore || left.title.localeCompare(right.title, "zh-CN"));
}
