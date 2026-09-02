# technobabble

## stack

| layer | tech | why |
| --- | --- | --- |
| backend | hono (deno) | lightweight, fast, runs anywhere deno runs |
| database | supabase (postgres) | open source, portable, row level security |
| meeting bots | recall.ai | handles zoom, meet, teams, slack, webex |
| browser fallback | browserbase | headless browser for discord, bluejeans, ringcentral |
| transcription | assembly.ai | real time + post meeting, good diarization |
| stt (alt) | speechmatics | better for non english and hinglish |
| tts (future) | speechify / vapi | voice output for asking questions |
| frontend | react + tanstack router | file based routing, fast |
| styling | tailwind v4 | semantic tokens, zero radius aesthetic |
| calendar | google calendar api | automatic meeting discovery |
| hosting | deno deploy / aws / any deno host | portable, no vendor lock in |

## database schema

six tables:

- **meetings** - the meeting record (url, platform, timing, config, status)
- **capture_requests** - what you want prixie to find (keywords, questions, status)
- **transcripts** - full transcript + summary + action items
- **profiles** - sandboxes identities (name, display name, email, context)
- **profile_memory** - per profile context and notes
- **global_memory** - shared knowledge across all profiles

row level security on all tables. service role key for backend operations only.

## recall.ai integration

prixie calls the recall.ai v1 api to:
- create bots (POST /v1/bot)
- check bot status (GET /v1/bot/{id})
- retrieve transcripts (GET /v1/bot/{id}/transcript)
- send chat messages (POST /v1/bot/{id}/send_chat_message)

webhooks receive:
- real time transcript chunks (POST /webhooks/recall/realtime)
- bot status changes (POST /webhooks/recall/status)

## browserbase integration (planned)

for unsupported platforms:
1. create a browserbase session
2. navigate to the meeting url
3. use browser automation to click join, enter name, accept terms
4. capture tab audio via media capture api
5. stream audio to assembly.ai for transcription
6. run the same keyword detection logic
7. screenshot on demand

## diarization

hybrid approach:
- recall.ai provides per participant audio streams when available (most zoom and meet calls)
- when participants share a device (conference room), machine diarization splits speakers
- speaker labels: participant name when recall.ai provides it, generic label ("speaker 1") when not

## hinglish transliteration

1. transcribe normally with assembly.ai
2. detect any devanagari unicode characters in the transcript
3. transliterate to latin script (phonetic, not translation)
4. wrap hinglish portions in italics
5. keep english portions as is
6. the goal: someone who already understands hinglish can read it without switching scripts
