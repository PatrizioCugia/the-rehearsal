import type { StrippedInter1, HistoryEntryForCoach } from "@/lib/coach-payload";

/**
 * Canned coach lines for MOCK_MODE and for the offline-fallback path when the
 * live coach call fails. The pool is intentionally small (a handful of lines)
 * so the demo can run fully offline. Lines pick deterministically from the
 * current take number + signal mix so a repeat take feels stable.
 *
 * Register-locked: short declarative sentences, no exclamation marks, no
 * emoji, always proposes another rehearsal unless mode is "stopping".
 */

export function mockCoachLine(args: {
  takeNumber: number;
  history: HistoryEntryForCoach[];
  inter1: StrippedInter1;
  mode: "continuing" | "stopping";
  thresholdCqi: number;
}): string {
  const cqi = args.inter1.conversation_quality?.overall?.quality_index;
  const hesitationSignals = args.inter1.signals.filter(
    (s) => s.type === "hesitation"
  );
  const noSignals = args.inter1.signals.length === 0;

  if (args.mode === "stopping") {
    return stoppingLine(cqi);
  }

  if (noSignals) {
    return "The model detected no signals at all. You were either completely composed or entirely absent. Both are possible. I cannot distinguish between them, and I have noted this for the record. We will go again, and this time I would like you to stand closer to where I have placed the lamp.";
  }

  // Reference prior take if we have one.
  const prior = args.history[args.history.length - 1];
  if (prior && hesitationSignals.length > 0 && hesitationSignals[0]) {
    const h = hesitationSignals[0];
    const len = Math.round(h.end - h.start);
    const priorH =
      prior.signals.find((s) => s.type === "hesitation");
    if (priorH) {
      const priorLen = Math.round(priorH.end - priorH.start);
      const priorTake = numberWord(prior.takeNumber);
      return `Hesitation now lasts ${numberWord(
        len
      )} seconds. In rehearsal ${priorTake} it lasted ${numberWord(
        priorLen
      )}. ${cqiLine(cqi, prior.cqiOverall)} We will do one more.`;
    }
  }

  // Threshold-crossed branch.
  if (typeof cqi === "number" && cqi >= args.thresholdCqi) {
    return `${cqiLine(cqi)} By the standard I set for myself this morning, that is adequate. You may stop here. I have prepared one more set of materials in case you choose to continue.`;
  }

  // First take or no useful prior comparison.
  return `Rehearsal ${numberWord(args.takeNumber)} is complete. ${signalSummary(
    args.inter1
  )} ${cqiLine(cqi)} I have reserved the room. We will go again.`;
}

function stoppingLine(cqi: number | undefined): string {
  if (typeof cqi === "number" && cqi >= 75) {
    return `${numberWord(
      Math.round(cqi)
    )}. By the standard I set for myself this morning, that is adequate. You may stop here. I want you to know that you could also have continued. The room was booked until eleven.`;
  }
  return "The session has been closed. I want you to know that you could also have continued. The room was booked until eleven.";
}

function cqiLine(cqi: number | undefined, prior?: number): string {
  if (typeof cqi !== "number") return "Your overall score was not recorded.";
  if (typeof prior === "number") {
    const diff = Math.round(cqi - prior);
    if (diff > 1) {
      return `You are at ${numberWord(
        Math.round(cqi)
      )}, up from ${numberWord(Math.round(prior))}.`;
    }
    if (diff < -1) {
      return `You are at ${numberWord(
        Math.round(cqi)
      )}, down from ${numberWord(Math.round(prior))}.`;
    }
    return `You are at ${numberWord(Math.round(cqi))}, similar to last time.`;
  }
  return `Your overall score was ${numberWord(Math.round(cqi))}.`;
}

function signalSummary(inter1: StrippedInter1): string {
  const types = Array.from(new Set(inter1.signals.map((s) => s.type)));
  if (types.length === 0) return "The model produced no signals.";
  if (types.length === 1) return `The model registered ${types[0]}.`;
  return `The model registered ${types.slice(0, -1).join(", ")} and ${types[
    types.length - 1
  ]}.`;
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

function numberWord(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.round(Math.abs(n));
  if (abs <= 12) return NUMBER_WORDS[abs] ?? String(abs);
  // For larger numbers, write the digits — TTS will read them deliberately.
  return String(abs);
}

/**
 * The fallback canned lines used when the live coach LLM fails outside of
 * MOCK_MODE. These need to feel like a real coach saying less because the
 * day is going poorly, not like an error message.
 */
export const COACH_LIVE_FALLBACK_LINES: string[] = [
  "Your assessment is unavailable. This has happened before. We can still discuss the rehearsal in person. We will go again.",
  "The behavioural model returned, but the assessment did not. I have noted the time and the take number. We will do one more.",
  "I have nothing to give you for this take. The room is still booked. We will go again.",
];

export function pickFallbackCoachLine(takeNumber: number): string {
  const idx = Math.max(0, takeNumber - 1) % COACH_LIVE_FALLBACK_LINES.length;
  return COACH_LIVE_FALLBACK_LINES[idx]!;
}
