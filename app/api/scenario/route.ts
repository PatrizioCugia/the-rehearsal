import { NextRequest, NextResponse } from "next/server";
import {
  SCENARIO_SYSTEM_PROMPT,
  buildScenarioUserMessage,
} from "@/lib/scenario-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export type Scenario = {
  title: string;
  scenePartnerLine: string;
  framing: string;
};

const FALLBACK: Scenario = {
  title: "An interaction the person has decided to prepare for.",
  scenePartnerLine: "Have a seat.",
  framing:
    "The details have been omitted. The rehearsal will proceed without them.",
};

function tryParseScenario(text: string): Scenario | null {
  // Strip code fences if the model included them.
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    const obj = JSON.parse(t) as Partial<Scenario>;
    if (obj && obj.title && obj.scenePartnerLine && obj.framing) {
      return {
        title: String(obj.title),
        scenePartnerLine: String(obj.scenePartnerLine),
        framing: String(obj.framing),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  let body: { location?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const location = (body.location ?? "").trim();
  const description = (body.description ?? "").trim();
  if (!location || !description) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
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
