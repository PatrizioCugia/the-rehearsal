# CLAUDE.md — The Rehearsal

## What this is

An internal hackathon project at **Interhuman AI**. A deadpan "rehearsal coach" web app, themed after the obsessive over-preparation of trivial social interactions. The user rehearses one side of a mundane conversation on webcam; the app streams the video to Interhuman's Inter-1 model, gets back social signals, and a persona LLM narrates a clinical, deadpan **Rehearsal Report** — voiced and played back over the recording. Multiple takes, a take counter, and an improvement curve.

The whole thing is a toy. It is meant to be funny.

## What winning looks like (the prime directive)

The judges are the company's founders. Optimize, **in this exact priority order**:

1. **Delight / deadpan comedy** — this is the point. The report's dry, over-serious narration is the product.
2. **Technical impressiveness** — real live streaming integration, multi-take state, an improvement chart.
3. **On-brand use of Inter-1** — it showcases the company's own model doing what it does best.
4. **Usefulness** — least important. Do not sacrifice the bit for utility.

**It must survive a live demo.** Demo-first always: a smaller thing that works flawlessly beats a bigger thing that's flaky. Degrade gracefully on any API error — never hard-crash mid-take.

## The core loop

1. User picks an absurd-mundane scenario.
2. User rehearses their side on webcam → video streams live to Inter-1.
3. A live HUD shows signals + engagement lighting up as they talk (updates on the ~3s segment beat).
4. On stop: persona LLM reads the Inter-1 JSON and writes a short deadpan report referencing specific moments.
5. ElevenLabs TTS speaks the report; it plays over the replay of the take (documentary-over-footage).
6. "Rehearse again" → take counter increments → improvement curve (CQI up, hesitation down across takes).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** for the frontend.
- Browser captures webcam via `getUserMedia` + `MediaRecorder`, streams to Inter-1 over WebSocket.
- **Next.js API routes as a thin backend proxy** for ElevenLabs and the persona LLM, so those keys stay server-side. (A separate FastAPI service is fine if preferred, but API routes mean fewer moving parts for a 2-day build.)
- State in React; persist takes in memory or `localStorage`. Keep it simple.

## Inter-1 integration (the heart of it)

Docs: https://docs.interhuman.ai · Stream quickstart: https://docs.interhuman.ai/getting-started/stream-analyze-quickstart

**Streaming endpoint:** `wss://api.interhuman.ai/v1/stream/analyze`

- Connect (browser): `new WebSocket(WS_URL, INTERHUMAN_API_KEY)` — the key is passed as the WS **subprotocol**. Set `ws.binaryType = "arraybuffer"`.
- On `open`, send a session-config **text** frame (JSON):
  `{ "include": ["conversation_quality_overall", "conversation_quality_timeline"] }`
- Capture with `MediaRecorder`, **segment every 3000ms**. On `dataavailable`, send the chunk as a **binary** frame (`await blob.arrayBuffer()` → `ws.send(buffer)`). Prefer `video/webm;codecs=vp9,opus` (feature-detect with `isTypeSupported`).
- Read server messages (text frames, JSON). Every envelope has `type`, `timestamp`, `correlation_id`, `data`. Branch on `type`:
  - `signal.detected` → `data.signals[]`, each `{ type, start, end, probability, rationale }`
  - `engagement.updated` → `data: { state, start, end }`
  - `conversation_quality.updated` → `data: { overall, timeline }` (only when opted in via `include`)
  - `error` → `data: { code, message, link, segment? }`

**Signal vocabulary (10 discrete signals):** agreement, confidence, confusion, disagreement, frustration, hesitation, interest, skepticism, stress, uncertainty. `probability` is `low | medium | high`. Engagement is a **separate continuous track** (`engaged | neutral | disengaged`), not a signal. CQI is 0–100 across five dimensions: Clarity, Authority, Energy, Rapport, Learning.

**Constraints to design around:**
- Single-speaker-in-frame. The rehearser is the only subject; the scene partner is on-screen text or pre-generated audio, never a second face.
- Feedback lands per ~3s segment, not frame-by-frame. Update the HUD on that beat so it reads as intentional, not laggy.

**Auth note:** the browser exposes the Inter-1 key via the subprotocol — acceptable for an internal demo. Keep ElevenLabs and LLM keys server-side. Optionally install the Interhuman **Agent Skill** (https://docs.interhuman.ai/how-to/agent-skills) to call the API through packaged workflows.

## The persona (the comedy engine)

A second LLM (a Sonnet-class Claude model — confirm current model IDs in the Anthropic docs) narrates Inter-1's output as a deadpan rehearsal coach. **This is not Inter-1's job** — Inter-1 supplies the clinical facts; the persona delivers them.

Hard register rules:
- Treat trivial interactions as grave and high-stakes. The tone-to-stakes mismatch is the joke.
- **Never wink.** No exclamation marks. No emoji. Never name or acknowledge that anything is funny. No puns or wordplay.
- Unearned methodical confidence — propose escalating, faintly unhinged rehearsal plans as if obviously reasonable.
- Faux-empathy, slightly miscalibrated. Over-honest observations stated as flat fact.
- Short declarative sentences. Brevity. The occasional quiet self-implication.
- Deadpan-affectionate, never cruel. The coach believes it is helping.

Output: **2–5 short sentences, max.** Reference specific moments from the JSON ("At second four, you said the word 'maybe'."). Keep the system prompt and few-shot examples in `/lib/persona/`. Write the few-shot examples for **spoken** delivery (they read differently than on-screen text).

**IP guardrail:** original voice and persona only. Do **not** clone, impersonate, or name any real person, and do not reproduce lines from any show. The comedy is the register, not a brand.

## Voice (ElevenLabs)

- Voice is pre-designed via Voice Design (deadpan, dry, flat, unhurried). Store its ID as `ELEVENLABS_VOICE_ID`.
- TTS is called **server-side**. Model: `eleven_multilingual_v2` for quality; `eleven_flash_v2_5` if low latency matters later.
- Pacing: short sentences and hard full stops; use `<break time="0.6s"/>` tags **sparingly** (overuse destabilizes audio). Spell out numbers you want spoken cleanly.
- Playback: play the returned audio over the replay of the recorded take.

## Scenarios

Absurd-mundane. Seed list (in `/lib/scenarios/`): asking for a raise; returning a cold coffee; telling your roommate to do the dishes; ending things with your hairdresser. Scene-partner prompts as on-screen text, or pre-generated TTS if there's time.

## Build sequence

**Day 1 — prove the pipe.** Webcam capture → WS stream to Inter-1 → render raw signals + engagement live in a HUD. End-to-end loop working with placeholder report text.

**Day 2 — the magic.** Persona LLM narration from real JSON → ElevenLabs TTS → replay with voiceover → multi-take state, take counter, improvement chart → polish the reveal (a tense "analyzing…" beat, the rationale typing out).

## Conventions & guardrails

- Demo-first. Fail soft: on API errors show a calm fallback, never a crash.
- Keep it simple. No premature abstraction, no over-engineering.
- TypeScript strict; small, focused components.
- Secrets in `.env.local`: `INTERHUMAN_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`. Never commit them. Server-side only, except the Inter-1 WS key.
- Do **not** build anything resembling a dataset browser or day-job data tooling. This is a toy, and looking like the day job loses points.

## Commands

_Fill in once scaffolded (e.g. `npm run dev`, `npm run build`, `npm run lint`)._

## Open questions for the human

- Final scenario list?
- Leaderboard: per-session only, or persisted across sessions?
- Is the report live-narrated over replay, or shown as text first then voiced on a button press?
