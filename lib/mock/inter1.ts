import type { StrippedInter1 } from "@/lib/coach-payload";

/**
 * Canned Inter-1 payloads that vary by take number, so the curve and the
 * coach's cross-take callbacks are demonstrable in MOCK_MODE.
 *
 * Pattern:
 *  - Take 1: low CQI (~38), significant hesitation
 *  - Take 2: ~52, hesitation shrinks
 *  - Take 3: ~64, confidence appears
 *  - Take 4: ~78, crosses the 75 threshold
 *  - Take 5+: ~85, mostly composed
 *
 * Slight per-take jitter so it doesn't look hand-tuned.
 */
export function mockInter1ForTake(take: number): StrippedInter1 {
  const t = Math.max(1, Math.floor(take));

  if (t === 1) {
    return {
      signals: [
        { type: "hesitation", start: 2.1, end: 7.4 },
        { type: "uncertainty", start: 9.0, end: 13.2 },
        { type: "stress", start: 15.5, end: 19.1 },
      ],
      engagement_state: [{ state: "neutral", start: 0, end: 22 }],
      conversation_quality: {
        overall: {
          quality_index: 38,
          clarity: 41,
          authority: 31,
          energy: 44,
          rapport: 39,
          learning: 50,
        },
        timeline: [
          {
            start: 0,
            end: 11,
            values: {
              quality_index: 35,
              clarity: 40,
              authority: 28,
              energy: 42,
              rapport: 36,
              learning: 50,
            },
          },
          {
            start: 11,
            end: 22,
            values: {
              quality_index: 41,
              clarity: 42,
              authority: 34,
              energy: 46,
              rapport: 42,
              learning: 50,
            },
          },
        ],
      },
    };
  }

  if (t === 2) {
    return {
      signals: [
        { type: "hesitation", start: 3.2, end: 5.6 },
        { type: "uncertainty", start: 10.1, end: 12.0 },
      ],
      engagement_state: [{ state: "neutral", start: 0, end: 20 }],
      conversation_quality: {
        overall: {
          quality_index: 52,
          clarity: 55,
          authority: 47,
          energy: 53,
          rapport: 54,
          learning: 50,
        },
      },
    };
  }

  if (t === 3) {
    return {
      signals: [
        { type: "hesitation", start: 4.0, end: 5.2 },
        { type: "confidence", start: 9.0, end: 14.5 },
      ],
      engagement_state: [
        { state: "neutral", start: 0, end: 8 },
        { state: "engaged", start: 8, end: 20 },
      ],
      conversation_quality: {
        overall: {
          quality_index: 64,
          clarity: 66,
          authority: 60,
          energy: 65,
          rapport: 67,
          learning: 50,
        },
      },
    };
  }

  if (t === 4) {
    return {
      signals: [
        { type: "confidence", start: 1.5, end: 7.0 },
        { type: "agreement", start: 9.0, end: 13.0 },
        { type: "hesitation", start: 16.0, end: 16.8 },
      ],
      engagement_state: [{ state: "engaged", start: 0, end: 20 }],
      conversation_quality: {
        overall: {
          quality_index: 78,
          clarity: 80,
          authority: 73,
          energy: 79,
          rapport: 82,
          learning: 50,
        },
      },
    };
  }

  // Take 5 and beyond: plateau around 85, almost no flagged time.
  const jitter = ((t * 17) % 7) - 3; // -3..3
  return {
    signals: [
      { type: "confidence", start: 1.0, end: 8.0 },
      { type: "agreement", start: 10.0, end: 15.5 },
    ],
    engagement_state: [{ state: "engaged", start: 0, end: 20 }],
    conversation_quality: {
      overall: {
        quality_index: 85 + jitter,
        clarity: 84,
        authority: 80,
        energy: 86,
        rapport: 88,
        learning: 50,
      },
    },
  };
}
