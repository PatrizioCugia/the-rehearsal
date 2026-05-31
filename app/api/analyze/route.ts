import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const apiKey = process.env.INTERHUMAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "INTERHUMAN_API_KEY not set" },
      { status: 500 }
    );
  }

  const incoming = await req.formData();
  const file = incoming.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "bad_request", message: "missing file" },
      { status: 400 }
    );
  }

  const outgoing = new FormData();
  outgoing.append("file", file, "take.webm");
  outgoing.append("include[]", "conversation_quality_overall");
  outgoing.append("include[]", "conversation_quality_timeline");

  const res = await fetch("https://api.interhuman.ai/v1/upload/analyze", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: outgoing,
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "upstream_non_json", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }
}
