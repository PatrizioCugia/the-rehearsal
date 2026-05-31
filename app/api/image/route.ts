import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 120;

const FACE_DIR = resolve(process.cwd(), "scripts/fixtures/face");
const MODEL = "gpt-image-1";

function mimeFor(path: string): string {
  const e = extname(path).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

async function loadFaceReferences(): Promise<Array<{ name: string; mime: string; bytes: Buffer }>> {
  try {
    const entries = await readdir(FACE_DIR);
    const files = entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .map((f) => resolve(FACE_DIR, f))
      .slice(0, 4);
    return Promise.all(
      files.map(async (p) => ({
        name: basename(p),
        mime: mimeFor(p),
        bytes: await readFile(p),
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "OPENAI_API_KEY not set" },
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
    const prompt = buildPrompt(location, description);

    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("n", "1");
    for (const r of refs) {
      form.append(
        "image[]",
        new Blob([new Uint8Array(r.bytes)], { type: r.mime }),
        r.name
      );
    }

    const endpoint = refs.length > 0
      ? "https://api.openai.com/v1/images/edits"
      : "https://api.openai.com/v1/images/generations";

    let res: Response;
    if (refs.length > 0) {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } else {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[image] upstream", res.status, text.slice(0, 800));
      return NextResponse.json(
        { error: "upstream", status: res.status, body: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = json.data?.[0];
    const b64 = item?.b64_json;
    if (b64) {
      return NextResponse.json({ image: `data:image/png;base64,${b64}` });
    }
    if (item?.url) {
      return NextResponse.json({ image: item.url });
    }
    return NextResponse.json({ error: "no_image_in_response" }, { status: 502 });
  } catch (e) {
    console.error("[image] threw", e);
    return NextResponse.json({ error: "exception" }, { status: 502 });
  }
}
