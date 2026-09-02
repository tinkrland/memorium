# prixie backend

> standalone, platform-independent backend for prixie — a personal meeting proxy agent.

prixie is an autonomous AI agent backend built to represent users in online meetings (Zoom, Google Meet, Microsoft Teams), record transcripts, monitor chat links, answer or capture specific requested items, and sign attendance forms.

---

## architecture & tech stack

- **runtime:** [Deno](https://deno.com) (TypeScript native)
- **web framework:** [Hono](https://hono.dev) (`npm:hono`)
- **database:** [Supabase](https://supabase.com) (`npm:@supabase/supabase-js`)
- **meeting bot engine:** [Recall.ai](https://www.recall.ai) (automated meeting bot CRUD, diarized transcription, chat integration, real-time webhooks)
- **calendar integration:** Google Calendar API via `googleapis`
- **zero platform lock-in:** completely free of vendor SDK dependencies. deployable anywhere Deno or Node container runtimes execute (Vercel, Railway, Render, Deno Deploy).

---

## directory structure

```
backend/
├── deno.json              # Deno configuration & import map
├── README.md              # Documentation & setup guide
├── supabase_schema.sql    # Supabase SQL schema & RLS policies
└── src/
    ├── index.ts           # Server entry point (Hono + Deno.serve)
    ├── types.ts           # TypeScript interfaces & DTOs
    ├── services/
    │   ├── recall.ts      # Recall.ai bot API client wrapper
    │   ├── supabase.ts    # Supabase database client & CRUD helpers
    │   └── calendar.ts    # Google Calendar synchronization
    ├── routes/
    │   ├── meetings.ts    # CRUD endpoints for meetings
    │   ├── capture.ts     # CRUD endpoints for capture requests
    │   ├── transcripts.ts # Endpoint to retrieve transcripts & summaries
    │   ├── deploy.ts      # Endpoint to manually deploy prixie bot to a call
    │   └── webhooks/
    │       ├── recall_realtime.ts   # Real-time transcript & chat event listener
    │       ├── recall_status.ts     # Bot status update listener
    │       └── google_calendar.ts   # Google Calendar push notification listener
    └── scheduler/
        └── meeting_manager.ts      # Cron job for auto-deploying bots & retrieving transcripts
```

---

## environment variables

Copy `.env.example` from the parent directory to `.env` in your deployment environment:

```bash
# Server Configuration
PORT=8000
BASE_URL=https://prixie.yourdomain.com
ENABLE_SCHEDULER=true

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Recall.ai Integration
RECALL_API_KEY=your-recall-api-key
RECALL_BASE_URL=https://api.recall.ai/api/v1
BOT_NAME=prixie

# Google Calendar Integration (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://prixie.yourdomain.com/webhooks/google-calendar
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
```

---

## database setup (supabase)

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the entire contents of `supabase_schema.sql`.
4. Copy your project URL and service role key into your `.env` file.

The schema creates four core tables:
- `meetings` — stores scheduled and active meetings with platform credentials and bot IDs.
- `capture_requests` — stores items to capture, questions to answer, or keywords to watch.
- `transcripts` — stores full meeting transcripts, generated summaries, and action items.
- `attendance_messages` — logs attendance messages posted into meeting chat windows.

---

## running locally

Ensure [Deno v1.38+](https://deno.com) is installed.

```bash
# Run in development mode (with file hot reloading)
deno task dev

# Run in production mode
deno task start
```

The server will start at `http://localhost:8000`.

---

## api endpoints reference

### 1. health check
- **`GET /`**
  - Response: `{ "name": "prixie", "status": "ok", "message": "prixie is online and standing by for meetings" }`

### 2. meetings CRUD
- **`POST /api/meetings`** — Schedule a new meeting
  - **Body:**
    ```json
    {
      "title": "Weekly Strategy Sync",
      "platform": "zoom",
      "join_url": "https://zoom.us/j/123456789",
      "start_time": "2026-09-02T14:00:00Z",
      "join_delay_minutes": 2,
      "attendance_method": "chat_message",
      "attendance_form_url": "https://forms.gle/xyz",
      "instruction": "Listen for updates on Q3 roadmap"
    }
    ```
- **`GET /api/meetings`** — List meetings (`?status=scheduled|bot_joining|bot_in_meeting|completed|failed`)
- **`GET /api/meetings/:id`** — Get meeting details with capture requests & transcript
- **`PATCH /api/meetings/:id`** — Update meeting details
- **`DELETE /api/meetings/:id`** — Delete meeting

### 3. capture requests
- **`POST /api/meetings/:id/capture`** or **`POST /api/capture`** — Add a capture request
  - **Body:**
    ```json
    {
      "meeting_id": "uuid",
      "title": "Capture budget announcement",
      "type": "capture",
      "keywords": ["budget", "allocation", "q4 spending"],
      "check_chat": true,
      "screenshot_enabled": false
    }
    ```
- **`GET /api/capture?meeting_id=:id`** — List capture requests
- **`PATCH /api/capture/:id`** — Update a capture request
- **`DELETE /api/capture/:id`** — Delete a capture request

### 4. manual bot deployment
- **`POST /api/deploy/:meetingId`** — Manually deploy prixie to a meeting
  - Creates the Recall.ai bot with diarization, breakout room auto-accept, chat configuration, and real-time webhook endpoints.

### 5. transcripts
- **`GET /api/transcripts/:meetingId`** — Get full transcript, summary, and extracted action items for a completed meeting.

### 6. webhooks
- **`POST /webhooks/recall/realtime`** — Receives real-time transcript segments and chat messages from Recall.ai.
- **`POST /webhooks/recall/status`** — Receives bot lifecycle status updates (`bot.joining_call`, `bot.in_call`, `bot.call_ended`, `bot.recording_done`, `bot.fatal`).
- **`GET / POST /webhooks/google-calendar`** — Receives push notifications from Google Calendar to trigger automatic meeting synchronization.

---

## deployment options

### Deno Deploy
```bash
deployctl deploy --project=prixie src/index.ts
```

### Railway
1. Create a new Railway project and connect your GitHub repository.
2. Select **Deno** buildpack or Dockerfile.
3. Set environment variables in Railway settings.

### Render
1. Create a new **Web Service**.
2. Environment: **Deno** (or Docker).
3. Build Command: `deno task start` or `deno compile src/index.ts`.

### Vercel
Deploy using the Vercel Deno runtime or standard Node container adapter.

---

## license

MIT — prixie is open and platform-independent.
