import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requireEnv } from "./_util";

/**
 * Verify ElevenLabs TTS: one call, save audio to scripts/out/eleven.mp3.
 * Endpoint: POST /v1/text-to-speech/{voice_id}
 *   header: xi-api-key: <key>
 *   body: { text, model_id, voice_settings? }
 *   returns: audio bytes (mp3)
 */
const apiKey = requireEnv("ELEVENLABS_API_KEY");
const voiceId = requireEnv("ELEVENLABS_VOICE_ID");

const text =
  "Take one. We will now assess your performance. " +
  "At second four, you said the word maybe. We will return to that.";

const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;

console.log(`[eleven] POST ${url}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
  },
  body: JSON.stringify({
    text,
    model_id: "eleven_multilingual_v2",
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`[eleven] HTTP ${res.status}`);
  console.error(body.slice(0, 1000));
  process.exit(1);
}

const ab = await res.arrayBuffer();
const out = resolve("scripts/out/eleven.mp3");
await mkdir(resolve("scripts/out"), { recursive: true });
await writeFile(out, Buffer.from(ab));

console.log(`[eleven] OK — ${ab.byteLength}B written to ${out}`);
console.log(`[eleven] content-type: ${res.headers.get("content-type")}`);
