import { describe, expect, it } from "vitest";
import { importXiaohongshuPerformanceRows, rankContentTopics, scoreContentPerformance } from "../src/index.js";

const rows = [
  ["导出说明"],
  ["笔记标题", "首次发布时间", "体裁", "曝光", "观看量", "封面点击率", "点赞", "评论", "收藏", "涨粉", "分享", "人均观看时长", "弹幕"],
  ["案例 A", "2026年08月05日19时30分59秒", "图文", 1000, 200, 0.2, 10, 4, 8, 2, 2, 30, 0],
  ["案例 B", "2026年08月06日19时30分59秒", "图文", 1000, 260, 0.26, 25, 10, 12, 4, 4, 60, 0],
];

describe("Xiaohongshu content analytics", () => {
  it("imports the current workbook shape and normalizes its timestamp", () => {
    const records = importXiaohongshuPerformanceRows(rows);
    expect(records).toHaveLength(2);
    expect(records[0]!.firstPublishedAt).toBe("2026-08-05T19:30:59+08:00");
    expect(records[0]!.coverClickRate).toBe(0.2);
  });

  it("ranks by explainable rate components instead of raw exposure", () => {
    const ranked = rankContentTopics(importXiaohongshuPerformanceRows(rows));
    expect(ranked[0]!.title).toBe("案例 B");
    expect(Object.values(ranked[0]!.components).reduce((sum, value) => sum + value, 0)).toBeCloseTo(ranked[0]!.topicScore);
  });

  it("rejects invalid weights and percentage cells", () => {
    expect(() => scoreContentPerformance(importXiaohongshuPerformanceRows(rows)[0]!, { clickRate: { weight: 1, target: 1 }, engagementRate: { weight: 1, target: 1 }, saveShareRate: { weight: 0, target: 1 }, followRate: { weight: 0, target: 1 }, averageWatchSeconds: { weight: 0, target: 1 } })).toThrow(/权重之和/u);
    const invalid = rows.map(row => [...row]); invalid[2]![5] = 1.2;
    expect(() => importXiaohongshuPerformanceRows(invalid)).toThrow(/0 到 1/u);
  });
});
