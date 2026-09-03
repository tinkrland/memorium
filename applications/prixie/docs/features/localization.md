# localization

prixie speaks your meeting's language — not just literally. the localization toggle (deploy form, section 08) adapts her to locale: units, calendars, cultural context, participants' local time, and language mix. off by default; one checkbox enables the whole layer.

## the config

localization is a single optional object on each meeting (`localization` jsonb on the meetings table). when the toggle is off, no config is sent and prixie behaves as before. when on:

```json
{
  "unit_system": "metric",
  "week_start": "monday",
  "non_work_days": ["sat", "sun"],
  "audience": "international",
  "timezone_awareness": true,
  "transliteration": [
    { "language": "hindi", "priority": 1, "usage": 0.6 },
    { "language": "english", "priority": 2, "usage": 0.4 }
  ]
}
```

## 1. unit system

metric / imperial / us customary. distances, weights, temperatures, and measurements in speech and summaries follow the selection — "about 5 km" vs "about 3 miles", "30°C" vs "86°F".

## 2. week conventions

two knobs that work together:

- **week start** — sunday-start (common in the us, japan, parts of the middle east) vs monday-start (most of europe, iso 8601). affects phrases like "next wednesday" and "end of the week".
- **non-work days** — a per-day checkbox grid. sat + sun is the default; tick friday for countries where the weekend is fri–sat (e.g. much of the middle east), or set sun–thu workweeks. prixie uses this when she talks about "before the weekend", deadlines "by friday", or scheduling follow-ups.

## 3. audience

how much cultural context prixie assumes:

- **local** — shared context. she can say "the diwali break" or "thanksgiving weekend" and everyone in the call knows.
- **mixed** — mostly shared; she names things but adds a light gloss when needed.
- **international** — generic references. if you're on a call with someone abroad from germany, she says "a national holiday" instead of naming your local festival — they won't know which festival it was, and pretending otherwise feels alien.

## 4. timezone & locational awareness

a toggle (on by default within localization) that makes prixie reason about *where participants are*, not just where you are:

- she won't ask someone to "send it in the next few hours" when it's 7pm on a thursday for them — especially in a country where friday isn't a work day — even though it's 8am monday on a workday for you.
- she picks up on time-of-day norms: lunch hours, end-of-day, weekend proximity, and holidays she can infer from the config above.
- the rule: urgency is judged from the receiver's clock, not the deployer's.

## 5. transliteration — language mix

a dropdown multiselect where each selected language gets:

- **priority** — a reorderable rank (↑/↓). when languages conflict — which script a shared word should render in, which grammar shapes a sentence — the higher-priority language wins.
- **usage** — a 0–1 slider. how much of the meeting each language carries.

the canonical example is hinglish: select hindi and english, set hindi priority 1 with usage 0.6, english priority 2 with usage 0.4 — and prixie speaks a natural hindi-dominant mix rather than either pure language. set the sliders differently and the same two languages become english peppered with hindi. this connects to the existing hinglish service (`/api/hinglish/*`) which handles devanagari detection and transliteration on the transcript side.

with no languages selected, prixie mirrors the caller's language.

## where it lives

- frontend: deploy form section 08, `LocalizationConfig` in `lib/types.ts`, sent as `localization` on the deploy payload
- backend: `localization` on `CreateMeetingInput` / `UpdateMeetingInput` / `Meeting`, persisted as jsonb via `localization_schema.sql`
- consumers: the voice/agent layer reads `localization` alongside `voice_override` when composing responses — voice_override shapes *how she sounds*, localization shapes *where she sounds like she's from*.
