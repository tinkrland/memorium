# agent composition — how the config becomes behavior

a sketch of the layer that turns stored config into an actual localized, stylized voice. today the voice agent (`services/voice_agent.ts`) handles turn-taking mechanics — end-of-turn detection, interruptions, fillers — but nothing composes the agent's *persona directives* from the meeting's config. this is the missing wire.

## the one function

`composeSystemPrompt(meeting, profile)` — runs once at voice session creation, produces the system prompt the LLM answers from. four layers, each optional, each derived from config that already exists:

```
layer 0 — identity     : profile.context (persona description)
layer 1 — language style: voice_override.seriousness / professionalism / vocabulary
layer 2 — localization : units, week, audience, timezone awareness, transliteration mix
layer 3 — delivery     : fist / cadence / prosody / tone → tts parameters, not prompt text
```

layers 0–2 are prompt directives. layer 3 never enters the prompt — it configures the tts synthesis (rate, pitch contour, pause shaping) so the words and the *sound* stay independently tunable. that separation is the whole point of the voice gui: change how she speaks without changing what she says, and vice versa.

## sketch

```ts
// backend/src/services/prompt_composition.ts

import type { Meeting, VoiceOverride, LocalizationConfig } from "../types.ts";

export function composeSystemPrompt(meeting: Meeting, personaContext: string): string {
  const layers: string[] = [];
  const voice: VoiceOverride = meeting.voice_override ?? {};
  const loc: LocalizationConfig | null = meeting.localization ?? null;

  // layer 0 — identity
  if (personaContext) layers.push(`you are prixie. ${personaContext}`);

  // layer 1 — language style (sliders become directives)
  if (voice.seriousness !== undefined)
    layers.push(voice.seriousness < 0.35
      ? "sarcasm is welcome. dry wit, playful needling — never mean."
      : voice.seriousness > 0.7
        ? "be sincere and earnest. no sarcasm, no irony."
        : "a light touch of wit is fine; stay grounded.");
  if (voice.professionalism !== undefined)
    layers.push(voice.professionalism > 0.7
      ? "boardroom register. complete sentences, no filler, no slang."
      : voice.professionalism < 0.3
        ? "unfiltered casual. contractions, slang, stream of thought."
        : "professional but relaxed.");
  if (voice.vocabulary !== undefined)
    layers.push(voice.vocabulary > 0.7
      ? "precise, erudite word choices; technical terms where they fit."
      : voice.vocabulary < 0.3
        ? "current colloquial vocabulary; genz phrasing where natural."
        : "plain, clear vocabulary.");

  // layer 2 — localization
  if (loc) {
    if (loc.timezone_awareness)
      layers.push(`participants may be in other time zones. judge urgency and deadlines
        from THEIR clock and work norms, not the deployer's. non-work days: ${loc.non_work_days.join(", ")}.
        before asking anyone for anything time-bound, check whether it's a workday
        and a work hour where THEY are.`);
    if (loc.audience === "international")
      layers.push("your audience is international: use generic references ('a national holiday', 'the local spring festival') — never assume shared cultural context.");
    if (loc.audience === "local")
      layers.push("your audience shares your cultural context: name festivals, places and references directly.");
    layers.push(`units: ${loc.unit_system}. week starts ${loc.week_start}.`);

    if (loc.transliteration.length > 0) {
      const mix = loc.transliteration
        .map(t => `${t.language} (${Math.round(t.usage * 100)}%)`)
        .join(" then ");
      layers.push(`speak a natural mix of ${mix}. when languages conflict, the lower
        priority number wins. mirror the participants' mix rather than enforcing yours.`);
      if (loc.keep_technical_english)
        layers.push(`technical and math vocabulary (sin, cos, tan, log, matrix, derivative,
          integral, vector, lambda, compile, deploy...) stays in english verbatim —
          never transliterate or translate these terms.`);
    }
  }

  return layers.join("\n\n");
}

// layer 3 — delivery: same session, different consumer
export function composeDeliveryParams(voice: VoiceOverride): object {
  return {
    tts_rate: voice.cadence_wpm ? voice.cadence_wpm / 140 : 1,  // relative to synthesis baseline
    tts_prosody: voice.prosody ?? 0.4,
    pause_pattern: voice.fist_pause_pattern ?? "deliberate",
    startup_pattern: voice.fist_startup_pattern ?? "brief_pause",
    turn_entry_pattern: voice.fist_turn_entry_pattern ?? "beat",
  };
}
```

## where it plugs in

```
meeting created (deploy form)
  → localization + voice_override persisted on the meeting
voice session created (POST /api/voice/session)
  → load meeting + profile
  → composeSystemPrompt(meeting, profile.context)   ← new
  → composeDeliveryParams(meeting.voice_override)   ← new
  → session.context.system_prompt = …
  → tts params handed to the synthesis pipeline
```

the voice session route already receives `meeting_id` — it just needs to fetch the meeting (it currently doesn't) and call the composer before the session goes live.

## the stt side (assemblyai hooks)

localization also touches transcription, not just generation. assemblyai exposes two hooks that map cleanly onto the config:

- **keyterms** — when `keep_technical_english` is on, pass the technical lexicon (`["sin", "cos", "tan", "log", "matrix", ...]`) as keyterms on the transcription request, so "tan" inside hindi-heavy speech transcribes as english "tan" instead of drifting to a hindi homograph.
- **speech_models fallback chain** — `["universal-3-5-pro", "universal-2"]` with `language_detection: true` covers the curated list regardless of tier (see transliteration.md).
- optional: when the transliteration mix is known, a **custom prompt** on the transcription request ("this call mixes hindi and english") further biases recognition.

## why a sketch, not the implementation

the composer is trivial once the voice agent has an LLM loop to hang it on. the real work is upstream (persisted config — done) and downstream (the LLM loop itself, tts param plumbing, redis-backed sessions instead of in-memory). this doc fixes the contract — `composeSystemPrompt` / `composeDeliveryParams`, layer separation, config-to-directive mappings — so the implementation step is mechanical.
