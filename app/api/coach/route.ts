import { NextRequest, NextResponse } from "next/server";
import { COACH_SYSTEM_PROMPT, buildCoachUserMessage } from "@/lib/coach-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

type Inter1Signal = { type: string; start: number; end: number };
type Inter1Engagement = { state: string; start: number; end: number };
type Inter1CQI = {
  overall?: Record<string, number>;
  timeline?: Array<{ start: number; end: number; values: Record<string, number> }>;
};
type StrippedInter1 = {
  signals: Inter1Signal[];
  engagement_state?: Inter1Engagement[];
  conversation_quality?: Inter1CQI;
};

function stripInter1Payload(raw: unknown): StrippedInter1 {
  const src = (raw ?? {}) as Record<string, unknown>;
  const signals = Array.isArray(src.signals)
    ? (src.signals as Array<Record<string, unknown>>).map((s) => ({
        type: String(s.type ?? ""),
        start: Number(s.start ?? 0),
        end: Number(s.end ?? 0),
      }))
    : [];
  const out: StrippedInter1 = { signals };
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  let body: { scenarioTitle?: string; takeNumber?: number; inter1?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const userMessage = buildCoachUserMessage({
    scenarioTitle: body.scenarioTitle ?? "Unknown scenario.",
    takeNumber: body.takeNumber ?? 1,
    inter1: stripInter1Payload(body.inter1),
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: COACH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "upstream_non_json", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json({ error: "upstream", upstream: json }, { status: res.status });
  }

  const content = (json as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const reportText = content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();

  return NextResponse.json({ report: reportText });
}
