import { NextRequest, NextResponse } from "next/server";
import {
  SCENARIO_SYSTEM_PROMPT,
  buildScenarioUserMessage,
} from "@/lib/scenario-prompt";
import { isMockMode } from "@/lib/mock";
import { mockScenario } from "@/lib/mock/scenario";
import { tryParseScenario, FALLBACK_SCENARIO_API } from "@/lib/scenario-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const FALLBACK = FALLBACK_SCENARIO_API;

export async function POST(req: NextRequest) {
  let body: { location?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const location = (body.location ?? "").trim();
  const description = (body.description ?? "").trim();

  if (isMockMode()) {
    return NextResponse.json(
      mockScenario({ location: location || "an unspecified location", description })
    );
  }

  if (!location || !description) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(FALLBACK);
  }

  try {
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
        system: SCENARIO_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildScenarioUserMessage({ location, description }),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[scenario] upstream", res.status, await res.text());
      return NextResponse.json(FALLBACK);
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");

    const parsed = tryParseScenario(text);
    return NextResponse.json(parsed ?? FALLBACK);
  } catch (e) {
    console.error("[scenario] threw", e);
    return NextResponse.json(FALLBACK);
  }
}
