import { describe, it, expect } from "vitest";
import { buildCurveData } from "@/lib/curve-data";
import type { Take } from "@/lib/session";

function take(args: Partial<Take> & { takeNumber: number }): Take {
  return {
    takeNumber: args.takeNumber,
    signals: args.signals ?? [],
    engagement: args.engagement,
    cqi: args.cqi,
    cqiOverall: args.cqiOverall,
    advice: args.advice ?? "",
    recordedAt: args.recordedAt ?? 0,
  };
}

describe("buildCurveData", () => {
  it("emits one point per take, preserving order", () => {
    const takes: Take[] = [
      take({ takeNumber: 1, cqiOverall: 38 }),
      take({ takeNumber: 2, cqiOverall: 51 }),
      take({ takeNumber: 3, cqiOverall: 62 }),
    ];
    const out = buildCurveData(takes);
    expect(out.map((p) => p.take)).toEqual([1, 2, 3]);
    expect(out.map((p) => p.cqi)).toEqual([38, 51, 62]);
  });

  it("rounds CQI to one decimal place", () => {
    const out = buildCurveData([
      take({ takeNumber: 1, cqiOverall: 63.7777 }),
    ]);
    expect(out[0]!.cqi).toBe(63.8);
  });

  it("emits null for missing CQI", () => {
    const out = buildCurveData([take({ takeNumber: 1 })]);
    expect(out[0]!.cqi).toBeNull();
  });

  it("sums hesitation duration per take", () => {
    const t = take({
      takeNumber: 1,
      signals: [
        { type: "hesitation", start: 2, end: 4.5 }, // 2.5s
        { type: "hesitation", start: 10, end: 11 }, // 1s
        { type: "confidence", start: 5, end: 8 }, // ignored
      ],
    });
    const out = buildCurveData([t]);
    expect(out[0]!.hesitation).toBe(3.5);
  });

  it("rounds hesitation to one decimal", () => {
    const t = take({
      takeNumber: 1,
      signals: [{ type: "hesitation", start: 0, end: 0.4444 }],
    });
    const out = buildCurveData([t]);
    expect(out[0]!.hesitation).toBe(0.4);
  });
});
