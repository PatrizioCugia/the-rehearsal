# The Rehearsal — Weekend Build Plan (v2)

_Friday afternoon → Sunday night. Claude Code for the build; Lovable optional for static UI scaffolding._

## Two pillars

This app stands on two cores, not one. Both are essential — neither is dressing.

1. **The engine** — the loop that makes it work: record → Inter-1 signals → coach LLM narrates in the deadpan register → ElevenLabs voices it → it proposes another rehearsal → repeat, with memory across takes.
2. **The image** — the face of it: the user dropped into a generated rehearsal set in the obsessive-prep staging (own face, generic wardrobe, laptop, flowchart). This is what makes it *feel* like the thing instead of a webcam bolted to a chatbot. The doubling is the gag: **prepared-you frozen in the set, live-you flailing on the webcam.**

The engine has to function for it to be an app; the image is what gives it identity. Build them as co-equal cores.

## Onboarding: the centerpiece flow

Two-message chat, designed so image latency disappears:

- **Message 1 — "Where does this take place?"** The instant they submit, fire the Nano Banana generation async (set + portrait). Fire-and-forget.
- **Message 2 — "Who are you, and what are you rehearsing?"** A paragraph about themselves and the scenario — longer to write. While they type, the image finishes. By the time they hit send, it's cached and ready to slot into the set. Message 2 also feeds the scenario-gen LLM and the coach's personalization.

The wait is hidden behind something the user is already doing — no spinner, no dead time. And if an image comes back cursed (sixth finger, melted laptop), that's *on brand*; in this register it's the funniest thing on screen. No pre-caching, no cherry-picking. Whatever it generates, ships.

## The de-risking principle (still worth it)

Two paths to the signals:
- **Report = batch analyze on the finished clip.** A plain POST of the saved recording. Reliable. Drives the full reveal. Part of the engine.
- **Live ticker = streaming WebSocket.** The subtle live signal during the take. Polish. If the socket wobbles, the ticker goes quiet and the report is untouched.

The comedic payload never rides on the fragile real-time path.

## Build sequence

### Phase 0 — Friday afternoon: prove every wire
Before any UI. Repo, CLAUDE.md, all four keys, and a throwaway script that hits each service once: batch-POST a clip to Inter-1, one coach-LLM call on fake JSON, one ElevenLabs line, and **one Nano Banana generation with your reference photo** — nail the face-into-scene call early, it's a pillar. Confirm everything's reachable and you know each response shape. The step people skip and regret.

### Phase 1 — Friday night / Saturday morning: engine + first set
The loop on one hardcoded scenario: record → batch-analyze → coach LLM → deadpan text → ElevenLabs → play. And generate one set + your portrait for that scenario, hardcoded in.
**End state:** a working, good-looking single rehearsal — you, in the set, getting assessed by the voice. Both pillars standing, ugly but real, by Saturday morning.

### Phase 2 — Saturday: onboarding + dynamic image
The two-message flow above. Msg 1 fires generation; msg 2 masks it and feeds scenario-gen. Dynamic set + portrait per session, slotted into the split-screen layout (set left, webcam ¾ right, subtle signal panel in the corner).
**End state:** the centerpiece works — describe a scenario, get dropped into your own bespoke rehearsal set.

### Phase 3 — Saturday night: the loop + memory
Multi-take, take counter ("Rehearsal #4"), take history fed into the coach prompt so it references prior attempts, continue/quit each round, a deadpan-arbitrary "good enough" bar, improvement curve (recharts).
**End state:** the obsessive arc, with a coach that remembers.

### Phase 4 — Sunday: polish + harden
Streaming live ticker (added now, as polish, on top of the working batch report). Replay-with-voiceover sync. Deadpan loading beats ("Constructing the set."). Layout polish. Demo run-throughs — pick the scenario, run it five times, fix what's flaky. Run locally on the demo laptop.

## Fallbacks (engine-critical only)

Light touch — most things degrade fine on their own.
- **Inter-1 socket fails** → batch analyze on the clip (report still works; ticker just goes quiet).
- **ElevenLabs fails** → show the report text immediately; voice is enhancement.
- **Coach LLM fails** → a couple of hardcoded deadpan lines.
- **Nano Banana** → embrace whatever it returns. Only if the API is fully down, drop to a plain backdrop with a deadpan "The set could not be constructed. We proceed without it." No pre-caching.

## Next workstreams
1. **Persona pack** — coach system prompt + spoken-delivery few-shots + the Inter-1-JSON-to-narration template. Highest leverage, pure prompt work, no integration.
2. **Scenario-gen prompt** — Rehearsal-style premise + plan, fed messages 1 and 2.
3. **Nano Banana prompt templates** — the prep-staging portrait (reference-photo workflow) + the per-scenario set. A pillar now, so worth getting sharp.
4. **Skills** — install the Inter-1 Agent Skill; check for Claude Code skills for the realtime/audio bits.

## Open
- Pick the demo scenario — mundane, personal, a little sad. That's the register.
