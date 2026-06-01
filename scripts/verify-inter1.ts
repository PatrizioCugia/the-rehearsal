/**
 * Direct, raw verification of Inter-1's upload endpoint.
 *
 * Hits POST https://api.interhuman.ai/v1/upload/analyze with a real clip and
 * prints the complete unmodified JSON, so the true signal-object shape is
 * unambiguous. Does NOT go through /api/analyze, mock mode, or any app strip
 * helper — this is the only way to see what Inter-1 actually returns.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-inter1.ts <path-to-clip>
 *   npm run verify:inter1 -- <path-to-clip>
 */

import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const MIN_BYTES = 10 * 1024;
const MAX_BYTES = 32 * 1024 * 1024;
const ALLOWED_EXTS = new Set(["mp4", "avi", "mov", "mkv", "ts", "m2ts", "webm"]);
const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  ts: "video/mp2t",
  m2ts: "video/mp2t",
};

function bail(msg: string, code = 2): never {
  console.error(`[inter1] ${msg}`);
  process.exit(code);
}

const apiKey = process.env.INTERHUMAN_API_KEY;
if (!apiKey) {
  bail("INTERHUMAN_API_KEY is not set. Load .env.local before running.");
}

const argPath = process.argv[2];
if (!argPath) {
  bail(
    "no clip path supplied.\n" +
      "  usage: npx tsx --env-file=.env.local scripts/verify-inter1.ts <path-to-clip>"
  );
}

const clipPath = resolve(argPath);

let info: Awaited<ReturnType<typeof stat>>;
try {
  info = await stat(clipPath);
} catch {
  bail(`file not found at ${clipPath}`);
}
if (!info.isFile()) bail(`not a regular file: ${clipPath}`);
const size = info.size;
if (size < MIN_BYTES) bail(`clip too small (${size}B). Minimum is ${MIN_BYTES}B.`);
if (size > MAX_BYTES) bail(`clip too large (${size}B). Maximum is ${MAX_BYTES}B.`);

const ext = extname(clipPath).replace(".", "").toLowerCase();
if (!ALLOWED_EXTS.has(ext)) {
  bail(
    `extension "${ext}" not in allowed list: ${[...ALLOWED_EXTS].join(", ")}`
  );
}
const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

const buf = await readFile(clipPath);

const form = new FormData();
form.append(
  "file",
  new Blob([new Uint8Array(buf)], { type: mime }),
  basename(clipPath)
);
form.append("include[]", "conversation_quality_overall");
form.append("include[]", "conversation_quality_timeline");

console.log("─".repeat(72));
console.log(`POST https://api.interhuman.ai/v1/upload/analyze`);
console.log(`  file:  ${basename(clipPath)}`);
console.log(`  size:  ${size} bytes`);
console.log(`  mime:  ${mime}`);
console.log(`  include[]: conversation_quality_overall, conversation_quality_timeline`);
console.log("─".repeat(72));

const startedAt = Date.now();
const res = await fetch("https://api.interhuman.ai/v1/upload/analyze", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
});
const elapsedMs = Date.now() - startedAt;

console.log(`\nHTTP ${res.status} ${res.statusText}   (${elapsedMs} ms)`);

const raw = await res.text();

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error("\nResponse was not JSON. Raw body:");
  console.error(raw);
  process.exit(1);
}

if (!res.ok) {
  console.error("\nError envelope (raw):");
  console.error(JSON.stringify(parsed, null, 2));
  const e = parsed as Record<string, unknown>;
  console.error("\nFields:");
  console.error(`  error_id:        ${String(e.error_id ?? "—")}`);
  console.error(`  message:         ${String(e.message ?? "—")}`);
  console.error(`  correlation_id:  ${String(e.correlation_id ?? "—")}`);
  console.error(`  link:            ${String(e.link ?? "—")}`);
  process.exit(1);
}

// ────────────────────────────────────────────────────────────
// Full raw payload, nothing omitted.
// ────────────────────────────────────────────────────────────
console.log("\n=== FULL RAW PAYLOAD (unmodified) ===");
console.log(JSON.stringify(parsed, null, 2));

// ────────────────────────────────────────────────────────────
// Definitive signal-shape proof.
// ────────────────────────────────────────────────────────────
const obj = parsed as Record<string, unknown>;
const signals = Array.isArray(obj.signals) ? (obj.signals as Array<Record<string, unknown>>) : [];

console.log("\n=== SIGNAL SHAPE PROOF ===");
console.log(`signals is an array of length: ${signals.length}`);
if (signals.length > 0) {
  const s0 = signals[0]!;
  const keys = Object.keys(s0).sort();
  console.log(`Object.keys(signals[0]) = ${JSON.stringify(keys)}`);
  console.log(`signals[0] =`);
  console.log(JSON.stringify(s0, null, 2));

  // Explicitly answer the open question.
  const expectedBare = ["end", "start", "type"];
  const isBare =
    keys.length === 3 &&
    expectedBare.every((k) => keys.includes(k));
  console.log(
    `\nDoes signals[0] match the documented bare {type,start,end} shape? ${
      isBare ? "YES" : "NO"
    }`
  );
  if (!isBare) {
    const extra = keys.filter((k) => !expectedBare.includes(k));
    console.log(`Extra keys present: ${JSON.stringify(extra)}`);
  }
} else {
  console.log("(no signals to inspect — shape cannot be determined from this clip)");
}

// ────────────────────────────────────────────────────────────
// One-line summary.
// ────────────────────────────────────────────────────────────
const types = signals.map((s) => String(s.type));
const engagementPresent = Array.isArray(obj.engagement_state)
  ? `yes (${(obj.engagement_state as unknown[]).length} windows)`
  : "no";
const cqi =
  obj.conversation_quality && typeof obj.conversation_quality === "object"
    ? "yes"
    : "no";

console.log("\n=== SUMMARY ===");
console.log(`signals:           ${signals.length}`);
console.log(`signal types:      ${types.length ? types.join(", ") : "(none)"}`);
console.log(`engagement_state:  ${engagementPresent}`);
console.log(`conversation_quality: ${cqi}`);
