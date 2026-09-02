import { Hono } from "hono";
import { cors } from "hono/cors";

import meetingsRouter from "./routes/meetings.ts";
import captureRouter from "./routes/capture.ts";
import transcriptsRouter from "./routes/transcripts.ts";
import deployRouter from "./routes/deploy.ts";
import profilesRouter from "./routes/profiles.ts";
import statsRouter from "./routes/stats.ts";
import browserbaseRouter from "./routes/browserbase.ts";
import lumaRouter from "./routes/luma.ts";
import calendlyRouter from "./routes/calendly.ts";
import hinglishRouter from "./routes/hinglish.ts";
import inboxRouter from "./routes/inbox.ts";
import liveLinksRouter from "./routes/live_links.ts";
import forumLinksRouter from "./routes/forum_links.ts";
import voiceAgentRouter from "./routes/voice_agent.ts";
import memoriumRouter from "./routes/memorium.ts";
import memoriumTagsRouter from "./routes/memorium_tags.ts";

import recallRealtimeWebhook from "./routes/webhooks/recall_realtime.ts";
import recallStatusWebhook from "./routes/webhooks/recall_status.ts";
import googleCalendarWebhook from "./routes/webhooks/google_calendar.ts";

import { meetingManager } from "./scheduler/meeting_manager.ts";

const app = new Hono();

app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.get("/", (c) => {
  return c.json({
    name: "prixie",
    status: "ok",
    message: "prixie is online and standing by for meetings",
    timestamp: new Date().toISOString(),
    routes: [
      "/api/meetings", "/api/capture", "/api/transcripts", "/api/deploy",
      "/api/profiles", "/api/stats", "/api/browserbase", "/api/luma",
      "/api/calendly", "/api/hinglish", "/api/inbox", "/api/live-links",
      "/api/forum", "/api/voice", "/api/memorium",
    ],
  });
});

// api routes
app.route("/api/meetings", meetingsRouter);
app.route("/api/capture", captureRouter);
app.route("/api/transcripts", transcriptsRouter);
app.route("/api/deploy", deployRouter);
app.route("/api/profiles", profilesRouter);
app.route("/api/stats", statsRouter);
app.route("/api/browserbase", browserbaseRouter);
app.route("/api/luma", lumaRouter);
app.route("/api/calendly", calendlyRouter);
app.route("/api/hinglish", hinglishRouter);
app.route("/api/inbox", inboxRouter);
app.route("/api/live-links", liveLinksRouter);
app.route("/api/forum", forumLinksRouter);
app.route("/api/voice", voiceAgentRouter);
app.route("/api/memorium", memoriumRouter);
app.route("/api/memorium", memoriumTagsRouter);

// webhooks
app.route("/webhooks/recall/realtime", recallRealtimeWebhook);
app.route("/webhooks/recall/status", recallStatusWebhook);
app.route("/webhooks/google-calendar", googleCalendarWebhook);

// scheduler
const enableScheduler = Deno.env.get("ENABLE_SCHEDULER") !== "false";
if (enableScheduler) {
  meetingManager.startScheduler(60000);
} else {
  console.log("prixie: meeting manager scheduler disabled");
}

const port = Number(Deno.env.get("PORT")) || 8000;
console.log(`prixie server running on port ${port}`);

Deno.serve({ port }, app.fetch);

export default app;
