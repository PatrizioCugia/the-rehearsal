/**
 * Shape the coach ever sees. Anything outside this is stripped on the client
 * before persisting to history AND on the server before being sent to Claude.
 * Belt-and-suspenders: if the API ever returns rationale, probability, or
 * transcript fields, they get filtered both places.
 */

export type Inter1Signal = {
  type: string;
  start: number;
  end: number;
  // Populated only when stripped with includeRationale=true. When the flag is
  // off, these keys are never assigned, so Object.keys(signal) stays exactly
  // ["end","start","type"] and the documented bare-shape contract still holds.
  probability?: "low" | "medium" | "high";
  rationale?: string;
};

export type Inter1Engagement = { state: string; start: number; end: number };
export type Inter1CQI = {
  overall?: Record<string, number>;
  timeline?: Array<{
    start: number;
    end: number;
    values: Record<string, number>;
  }>;
};

export type StrippedInter1 = {
  signals: Inter1Signal[];
  engagement_state?: Inter1Engagement[];
  conversation_quality?: Inter1CQI;
};

export type HistoryEntryForCoach = {
  takeNumber: number;
  signals: Inter1Signal[];
  engagement?: Inter1Engagement[];
  cqiOverall?: number;
  advice: string;
};

export type StripOptions = {
  /**
   * When true, allow `probability` and `rationale` to survive on each signal.
   * Default false — preserves the original strict-strip behavior that 21
   * existing tests pin and that the flag-off demo path depends on.
   */
  includeRationale?: boolean;
};

function stripSignals(
  raw: unknown,
  opts: StripOptions
): Inter1Signal[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((s) => {
    const out: Inter1Signal = {
      type: String(s.type ?? ""),
      start: Number(s.start ?? 0),
      end: Number(s.end ?? 0),
    };
    if (opts.includeRationale) {
      if (
        typeof s.probability === "string" &&
        (s.probability === "low" ||
          s.probability === "medium" ||
          s.probability === "high")
      ) {
        out.probability = s.probability;
      }
      if (typeof s.rationale === "string" && s.rationale.length > 0) {
        out.rationale = s.rationale;
      }
    }
    return out;
  });
}

export function stripInter1Payload(
  raw: unknown,
  opts: StripOptions = {}
): StrippedInter1 {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: StrippedInter1 = { signals: stripSignals(src.signals, opts) };
  if (Array.isArray(src.engagement_state)) {
    out.engagement_state = (src.engagement_state as Array<Record<string, unknown>>).map(
      (e) => ({
        state: String(e.state ?? ""),
        start: Number(e.start ?? 0),
        end: Number(e.end ?? 0),
      })
    );
  }
  if (src.conversation_quality && typeof src.conversation_quality === "object") {
    out.conversation_quality = src.conversation_quality as Inter1CQI;
  }
  return out;
}

export function stripHistoryEntries(
  raw: unknown,
  opts: StripOptions = {}
): HistoryEntryForCoach[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((h) => {
    const engagement = Array.isArray(h.engagement)
      ? (h.engagement as Array<Record<string, unknown>>).map((e) => ({
          state: String(e.state ?? ""),
          start: Number(e.start ?? 0),
          end: Number(e.end ?? 0),
        }))
      : undefined;
    return {
      takeNumber: Number(h.takeNumber ?? 0),
      signals: stripSignals(h.signals, opts),
      engagement,
      cqiOverall: typeof h.cqiOverall === "number" ? h.cqiOverall : undefined,
      advice: String(h.advice ?? ""),
    };
  });
}
