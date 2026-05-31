import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { extname, resolve, basename } from "node:path";
import { requireEnv, logShape } from "./_util";

/**
 * Verify Gemini "Nano Banana" face-into-scene generation.
 * Model: gemini-2.5-flash-image-preview
 * Endpoint: POST /v1beta/models/{model}:generateContent?key=<key>
 *
 * Inputs:
 *   - Reference photos in scripts/fixtures/face/ (jpg/jpeg/png).
 *   - Scenario string via --scenario "<text>" (or first non-flag arg). Defaults to a generic rehearsal.
 *
 * Output: scripts/out/gemini.png
 *
 * The prompt is intentionally generic — taped flowchart, laptop, fluorescent dread.
 * No naming, no recreated shots. The user's face from the references is the only specificity.
 */
const apiKey = requireEnv("GEMINI_API_KEY");

function parseArgs(argv: string[]): { scenario: string } {
  let scenario = "asking my boss for a raise tomorrow morning";
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenario" && argv[i + 1]) {
      scenario = argv[++i];
    } else if (!a.startsWith("--")) {
      scenario = a;
    }
  }
  return { scenario };
}

const { scenario } = parseArgs(process.argv);

const faceDir = resolve("scripts/fixtures/face");
let faceFiles: string[];
try {
  const entries = await readdir(faceDir);
  faceFiles = entries
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => resolve(faceDir, f));
} catch {
  console.error(
    `[gemini] no reference photos found.\n` +
      `Drop 1–4 photos of the subject into ${faceDir} (jpg/png) and re-run.`
  );
  process.exit(2);
}

if (faceFiles.length === 0) {
  console.error(
    `[gemini] ${faceDir} is empty.\n` +
      `Drop 1–4 photos of the subject (jpg/png) and re-run.`
  );
  process.exit(2);
}

const mimeFor = (p: string): string => {
  const e = extname(p).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
};

const referenceParts = await Promise.all(
  faceFiles.slice(0, 4).map(async (p) => ({
    inlineData: {
      mimeType: mimeFor(p),
      data: (await readFile(p)).toString("base64"),
    },
  }))
);

const prompt =
  `Photorealistic still of the person shown in the reference photographs, ` +
  `standing alone in a small, plain, slightly underdressed room that is being used as a private rehearsal space. ` +
  `On the wall behind them: a large hand-drawn flowchart on butcher paper, taped up crookedly, ` +
  `with boxes, arrows, and dense annotations describing the upcoming interaction. ` +
  `Open laptop on a folding table beside them, papers, a printed script. ` +
  `Wardrobe: a plain, neutral, slightly off outfit chosen to be inconspicuous for the scenario. ` +
  `Lighting: practical overhead, slight green cast, documentary realism, no glamour. ` +
  `The person is facing the camera, deadpan, mid-thought, not smiling. ` +
  `The room subtly reflects the scenario being rehearsed: "${scenario}". ` +
  `Frame: medium-wide, eye-level. Aspect 4:3. ` +
  `Keep the face matching the reference photographs closely. ` +
  `Do not include any other people. No text overlays. No on-screen captions.`;

const model = "gemini-2.5-flash-image";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
  apiKey
)}`;

console.log(`[gemini] scenario: ${scenario}`);
console.log(`[gemini] refs: ${faceFiles.map((f) => basename(f)).join(", ")}`);
console.log(`[gemini] POST ${model}:generateContent`);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }, ...referenceParts] }],
  }),
});

const text = await res.text();
let json: unknown;
try {
  json = JSON.parse(text);
} catch {
  console.error(`[gemini] non-JSON response (status ${res.status}):`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

if (!res.ok) {
  console.error(`[gemini] HTTP ${res.status}`);
  logShape("error body", json);
  process.exit(1);
}

const candidates = (json as {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    };
  }>;
}).candidates;

const parts = candidates?.[0]?.content?.parts ?? [];
const imagePart = parts.find((p) => p.inlineData);
const textOut = parts
  .filter((p) => p.text)
  .map((p) => p.text)
  .join("\n")
  .trim();

if (textOut) console.log(`[gemini] model text: ${textOut}`);

if (!imagePart?.inlineData) {
  console.error("[gemini] no inlineData image in response.");
  logShape("response", json);
  process.exit(1);
}

const bytes = Buffer.from(imagePart.inlineData.data, "base64");
const ext = imagePart.inlineData.mimeType.split("/").pop() ?? "png";
const out = resolve(`scripts/out/gemini.${ext}`);
await mkdir(resolve("scripts/out"), { recursive: true });
await writeFile(out, bytes);

console.log(`[gemini] OK — ${bytes.byteLength}B written to ${out}`);
console.log(`[gemini] mimeType: ${imagePart.inlineData.mimeType}`);
