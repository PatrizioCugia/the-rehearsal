import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { requireEnv, logShape } from "./_util";

/**
 * Verify Inter-1 upload endpoint.
 *
 * POST https://api.interhuman.ai/v1/upload/analyze
 *   multipart: file=<binary>, optional include[]=conversation_quality_overall|timeline
 *   Auth: Bearer <INTERHUMAN_API_KEY>
 *
 * Usage:
 *   npm run verify:inter1 -- ./path/to/clip.webm
 *
 * If no path is given, defaults to scripts/fixtures/test-clip.webm.
 * File must be 10KB–32MB and one of: mp4, avi, mov, mkv, mpeg-ts, mpeg-2-ts, webm.
 */
const apiKey = requireEnv("INTERHUMAN_API_KEY");

const argPath = process.argv[2];
const clipPath = resolve(argPath ?? "scripts/fixtures/test-clip.webm");

let buf: Buffer;
try {
  buf = await readFile(clipPath);
} catch (err) {
  console.error(
    `[inter1] could not read clip at ${clipPath}.\n` +
      `Pass a path: npm run verify:inter1 -- ./path/to/clip.webm`
  );
  console.error(err);
  process.exit(2);
}

if (buf.byteLength < 10 * 1024) {
  console.error(`[inter1] clip too small (${buf.byteLength}B). Minimum 10KB.`);
  process.exit(2);
}
if (buf.byteLength > 32 * 1024 * 1024) {
  console.error(`[inter1] clip too large (${buf.byteLength}B). Maximum 32MB.`);
  process.exit(2);
}

const ext = clipPath.split(".").pop()?.toLowerCase() ?? "";
const mimeByExt: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};
const mime = mimeByExt[ext] ?? "application/octet-stream";

const form = new FormData();
form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), basename(clipPath));
form.append("include[]", "conversation_quality_overall");
form.append("include[]", "conversation_quality_timeline");

console.log(`[inter1] POST /v1/upload/analyze  file=${basename(clipPath)} (${buf.byteLength}B, ${mime})`);

const res = await fetch("https://api.interhuman.ai/v1/upload/analyze", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
});

const text = await res.text();
let json: unknown;
try {
  json = JSON.parse(text);
} catch {
  console.error(`[inter1] non-JSON response (status ${res.status}):`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

if (!res.ok) {
  console.error(`[inter1] HTTP ${res.status}`);
  logShape("error body", json);
  process.exit(1);
}

logShape("inter1 response", json);

const signals = (json as { signals?: Array<{ type: string; start: number; end: number }> }).signals;
if (Array.isArray(signals)) {
  console.log(`[inter1] OK — ${signals.length} signals`);
  for (const s of signals.slice(0, 5)) {
    console.log(`  ${s.type}  [${s.start}s → ${s.end}s]`);
  }
} else {
  console.warn("[inter1] response missing `signals` array — see body above.");
}
