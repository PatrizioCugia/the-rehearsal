# Interhuman Skills — Agent Guide

_Reference for the coding agent. Grounded in the actual `InterhumanAI/skills` repo (README + both SKILL.md files). Live docs: https://docs.interhuman.ai_

## Install

```bash
npx skills add InterhumanAI/skills          # installs to this project
npx skills add InterhumanAI/skills --list   # list without installing
npx skills add InterhumanAI/skills --skill '*'   # install both
```

Targets Cursor, Claude Code, Codex, OpenCode. Useful flags: `-g/--global`, `-s/--skill <names>`, `-y/--yes`, `--all`.

## The two skills, mapped to our app

| Skill | Endpoint | Our use |
|---|---|---|
| `interhuman-post-processing` | `POST /v1/upload/analyze` (multipart) | **The report** — analyze the finished take. The reliable spine. |
| `interhuman-stream-analyze` | `wss://api.interhuman.ai/v1/stream/analyze` | **The live ticker** — subtle signals during the take. Polish; droppable. |

Both are **strict wrappers**: they return the API's raw JSON verbatim — no summarizing, filtering, or interpretation. Turning that JSON into deadpan narration is a *separate* step (our coach LLM), not something the skill does.

## What the API actually returns — READ THIS

The coach narration is built from this and nothing more:

- **A signal is `{ type, start, end }`** on upload; on the stream it's `data.signal_type` + `data.probability` (`high`/`medium`/`low`) inside an event envelope.
- **There is no rationale and no cue text.** The model reports *what* signal fired and *when* (seconds from start; on the stream, absolute session-cumulative across all segments). It never explains *why* in words. Any "you touched your collar" specificity must come from our own transcript (e.g. Whisper) or be understood as invented — it is not in the API.
- **Signal types (12):** `agreement`, `confidence`, `confusion`, `disagreement`, `disengagement`, `engagement`, `frustration`, `hesitation`, `interest`, `skepticism`, `stress`, `uncertainty`.
- **Engagement** comes back as `engagement_state` (upload) / `engagement.updated` events (stream).
- **Conversation quality (CQI)** is opt-in only, via `include[]`: `conversation_quality_overall` and/or `conversation_quality_timeline`. Omit if unused.

## Auth

Send the key directly — no token exchange:

```
Authorization: Bearer <api_key>
```

For the WebSocket, prefer the `Authorization` header; if the client can't set it on the handshake (e.g. the browser), pass the key as subprotocol: `Sec-WebSocket-Protocol: <api_key>`. Keep the key server-side for upload and the coach/TTS calls; the WS subprotocol key is exposed client-side, which is acceptable for an internal demo only.

## Upload skill — the report

- **Endpoint:** `POST https://api.interhuman.ai/v1/upload/analyze`, `Content-Type: multipart/form-data`, required field `file` (binary video).
- **Optional:** repeat `include[]=conversation_quality_overall` / `include[]=conversation_quality_timeline`.
- **File constraints:** 10 KB – 32 MB; formats mp4, avi, mov, mkv, mpeg-ts, mpeg-2-ts, webm.
- **Content requirement:** must contain *meaningful* video AND audio — a blank/black frame or a silent track degrades results. The rehearsal clip must show and capture the user speaking.

```bash
curl -X POST https://api.interhuman.ai/v1/upload/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@/path/to/take.webm;type=video/webm" \
  -F "include[]=conversation_quality_overall"
```

**Response:** `{ signals: [ {type, start, end}, ... ], engagement_state?, conversation_quality? }`.

**Errors:** JSON with `error_id`, `message`, optional `correlation_id`, optional `link`. Status codes: `400` bad request, `401` unauthorized, `403` forbidden, `413` too large (>32 MB), `422` file missing/invalid, `429` rate-limited, `500` server.

## Stream skill — the live ticker

- **URL:** `wss://api.interhuman.ai/v1/stream/analyze` (**v1 only** — do not use `/v0/stream/analyze`).
- **Workflow:** open WS with auth → optionally send a session-config JSON text frame → send **binary** video segments (one per message) → read JSON envelopes → close when done.
- **Segment constraints:** at least **3 s** each, max **32 MB** each, same formats, same meaningful-A/V requirement.
- **Session config (optional):** `{"include": ["conversation_quality_overall", "conversation_quality_timeline"]}`. Unknown values ignored; can be updated mid-session.
- **Envelopes:** every server message is `{ type, timestamp, correlation_id, data }`. Narrow on `type`:
  - `signal.detected` — `data.signal_type` + `data.probability`
  - `engagement.updated` — engagement state for the window
  - `conversation_quality.updated` — CQI sections per the `include` flags
  - `error` — `data.code` (e.g. `ih6002`), `data.message`, optional `data.link`, optional `data.segment`
- **Optional header:** `X-Client-Request-Id: <id>` for your own logs; the server returns a connection `correlation_id` in every envelope.

> The stream SKILL.md references a `reference.md` for full envelope schemas, but that file is not in the repo. For exact field lists beyond the above, consult https://docs.interhuman.ai rather than assuming fields.

## How this wires into the build

- **Phase 0 (prove the wire):** one `curl` upload of a short test clip; confirm the `signals` shape.
- **Phase 1 (report / spine):** record take → save clip → `interhuman-post-processing` → feed the `signals` (+ CQI if opted in) to the coach LLM → deadpan report → ElevenLabs.
- **Phase 4 (ticker / polish):** `interhuman-stream-analyze` with 3 s segments → render the most recent `signal.detected` quietly in the corner. If the socket misbehaves, the report path is untouched.
- **Optional:** run Whisper on the saved clip if you want the coach to quote the user's words at the timestamps Inter-1 flagged. Inter-1 itself supplies no words.
