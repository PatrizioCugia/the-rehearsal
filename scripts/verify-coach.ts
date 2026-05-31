import { requireEnv, logShape } from "./_util";

/**
 * Verify the coach LLM (Anthropic) end-to-end on fake signal JSON.
 * This is a throwaway shape check, NOT the real persona — the real persona
 * pack lands in a later phase. Here we just want to prove the wire works.
 */
const apiKey = requireEnv("ANTHROPIC_API_KEY");

const fakeSignals = {
  signals: [
    { type: "hesitation", start: 3.1, end: 5.4 },
    { type: "uncertainty", start: 7.0, end: 10.2 },
    { type: "confidence", start: 14.3, end: 18.9 },
  ],
};

const userPrompt =
  `Inter-1 returned this signal timeline for one take of a rehearsal. ` +
  `Write 2 short, flat, declarative sentences citing one specific moment. ` +
  `Do not invent physical cues. Do not invent words spoken. Reference only the timeline.\n\n` +
  JSON.stringify(fakeSignals);

console.log("[coach] POST https://api.anthropic.com/v1/messages");

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    messages: [{ role: "user", content: userPrompt }],
  }),
});

const text = await res.text();
let json: unknown;
try {
  json = JSON.parse(text);
} catch {
  console.error(`[coach] non-JSON response (status ${res.status}):`);
  console.error(text.slice(0, 1000));
  process.exit(1);
}

if (!res.ok) {
  console.error(`[coach] HTTP ${res.status}`);
  logShape("error body", json);
  process.exit(1);
}

const content = (json as { content?: Array<{ type: string; text?: string }> }).content ?? [];
const out = content
  .filter((b) => b.type === "text")
  .map((b) => b.text ?? "")
  .join("\n")
  .trim();

logShape("coach response (full)", json);
console.log("[coach] text:\n" + out + "\n");
console.log("[coach] OK");
