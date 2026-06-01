import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 120;

const FACE_DIR = resolve(process.cwd(), "scripts/fixtures/face");
const MODEL = "nano-banana-pro-preview";

function mimeFor(path: string): string {
  const e = extname(path).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

async function loadFaceReferences(): Promise<
  Array<{ inlineData: { mimeType: string; data: string } }>
> {
  try {
    const entries = await readdir(FACE_DIR);
    const files = entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .map((f) => resolve(FACE_DIR, f))
      .slice(0, 4);
    return Promise.all(
      files.map(async (p) => ({
        inlineData: {
          mimeType: mimeFor(p),
          data: (await readFile(p)).toString("base64"),
        },
      }))
    );
  } catch {
    return [];
  }
}

function buildPrompt(location: string, description: string): string {
  return (
    `Photorealistic still of the person shown in the reference photographs, alone, ` +
    `standing in a small private space they have set up to rehearse one specific upcoming interaction. ` +
    `Location of the rehearsal space: ${location}. ` +
    `Context of the upcoming interaction: ${description}. ` +
    `On a wall behind them: a hand-drawn flowchart on butcher paper, taped up crookedly, ` +
    `with boxes and arrows describing the interaction. ` +
    `An open laptop on a folding table beside them, papers, a printed script. ` +
    `Wardrobe: a plain neutral outfit, inconspicuous, slightly off. ` +
    `Lighting: practical overhead, documentary realism, no glamour. ` +
    `The person is facing the camera, deadpan, mid-thought, not smiling. ` +
    `Frame: medium-wide, eye-level. ` +
    `Match the face in the reference photographs closely. ` +
    `Only one person in frame. No text overlays, no captions.`
  );
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "GEMINI_API_KEY not set" },
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
  if (!location) {
    return NextResponse.json({ error: "missing_location" }, { status: 400 });
  }

  try {
    const refs = await loadFaceReferences();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(location, description) }, ...refs],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[image] upstream", res.status, text.slice(0, 500));
      return NextResponse.json(
        { error: "upstream", status: res.status },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { mimeType: string; data: string } }>;
        };
      }>;
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) {
      return NextResponse.json(
        { error: "no_image_in_response" },
        { status: 502 }
      );
    }
    const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    return NextResponse.json({ image: dataUrl });
  } catch (e) {
    console.error("[image] threw", e);
    return NextResponse.json({ error: "exception" }, { status: 502 });
  }
}
