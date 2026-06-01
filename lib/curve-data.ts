import type { Take } from "@/lib/session";
import { totalHesitationSeconds } from "@/lib/session";

export type CurvePoint = {
  take: number;
  cqi: number | null;
  hesitation: number;
};

/**
 * Pure transform: history → chart series. Extracted from Curve.tsx for
 * testability. Rounds to one decimal so the chart axis labels are stable.
 */
export function buildCurveData(takes: Take[]): CurvePoint[] {
  return takes.map((t) => ({
    take: t.takeNumber,
    cqi:
      typeof t.cqiOverall === "number"
        ? Math.round(t.cqiOverall * 10) / 10
        : null,
    hesitation: Math.round(totalHesitationSeconds(t) * 10) / 10,
  }));
}
