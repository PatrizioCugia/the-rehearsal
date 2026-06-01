import { describe, it, expect } from "vitest";
import { stripInter1Payload, stripHistoryEntries } from "@/lib/coach-payload";

describe("stripInter1Payload — the core guardrail", () => {
  it("keeps only {type,start,end} on signals; drops rationale/probability/anything else", () => {
    const raw = {
      signals: [
        {
          type: "stress",
          start: 20,
          end: 25,
          probability: "high",
          rationale: "He touched his nose. He spoke broken Italian.",
          spurious: { nested: "should also be gone" },
        },
        {
          type: "hesitation",
          start: 3.1,
          end: 9.4,
          probability: "medium",
          rationale: "should be stripped",
        },
      ],
    };
    const out = stripInter1Payload(raw);
    expect(out.signals).toHaveLength(2);
    for (const s of out.signals) {
      expect(Object.keys(s).sort()).toEqual(["end", "start", "type"]);
    }
    // No leakage at the object level.
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("rationale");
    expect(serialized).not.toContain("probability");
    expect(serialized).not.toContain("spurious");
    expect(serialized).not.toContain("nose");
    expect(serialized).not.toContain("Italian");
  });

  it("keeps engagement_state windows but strips extra keys on each", () => {
    const raw = {
      signals: [],
      engagement_state: [
        { state: "neutral", start: 0, end: 5, extra: "drop me" },
        { state: "engaged", start: 5, end: 20, debug: { x: 1 } },
      ],
    };
    const out = stripInter1Payload(raw);
    expect(out.engagement_state).toHaveLength(2);
    for (const e of out.engagement_state!) {
      expect(Object.keys(e).sort()).toEqual(["end", "start", "state"]);
    }
    expect(JSON.stringify(out)).not.toContain("debug");
    expect(JSON.stringify(out)).not.toContain("drop me");
  });

  it("preserves the conversation_quality block as-is when present", () => {
    const raw = {
      signals: [],
      conversation_quality: {
        overall: { quality_index: 63.7, clarity: 50 },
        timeline: [
          {
            start: 0,
            end: 10,
            values: { quality_index: 73 },
          },
        ],
      },
    };
    const out = stripInter1Payload(raw);
    expect(out.conversation_quality?.overall?.quality_index).toBe(63.7);
    expect(out.conversation_quality?.timeline?.[0]?.values?.quality_index).toBe(73);
  });

  it("handles missing/empty input without throwing", () => {
    expect(stripInter1Payload(null).signals).toEqual([]);
    expect(stripInter1Payload(undefined).signals).toEqual([]);
    expect(stripInter1Payload({}).signals).toEqual([]);
    expect(stripInter1Payload({ signals: "not an array" }).signals).toEqual([]);
  });
});

describe("stripHistoryEntries — same guardrail extended to prior takes", () => {
  it("strips rationale-like fields from every prior take's signals", () => {
    const raw = [
      {
        takeNumber: 1,
        cqiOverall: 38,
        advice: "Rehearsal one is complete.",
        signals: [
          {
            type: "hesitation",
            start: 3,
            end: 9,
            rationale: "leak this and the prompt is contaminated",
            probability: "high",
          },
        ],
        engagement: [{ state: "neutral", start: 0, end: 12, debug: "drop" }],
      },
    ];
    const out = stripHistoryEntries(raw);
    expect(out).toHaveLength(1);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("rationale");
    expect(serialized).not.toContain("probability");
    expect(serialized).not.toContain("debug");
    expect(out[0]!.advice).toBe("Rehearsal one is complete.");
    expect(out[0]!.cqiOverall).toBe(38);
  });

  it("returns [] for non-array input", () => {
    expect(stripHistoryEntries(null)).toEqual([]);
    expect(stripHistoryEntries({})).toEqual([]);
    expect(stripHistoryEntries("nope")).toEqual([]);
  });
});
