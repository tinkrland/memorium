import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCurrentUser, listEvents, syncCalendlyEvents, handleCalendlyWebhook } from "../services/calendly.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// GET /api/calendly/user
app.get("/user", async (c) => {
  try {
    const user = await getCurrentUser();
    return c.json(user);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/calendly/events
app.get("/events", async (c) => {
  try {
    const user = await getCurrentUser();
    const events = await syncCalendlyEvents(user.resource.uri);
    return c.json(events);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/calendly/sync
// syncs calendly events to supabase meetings
app.post("/sync", async (c) => {
  try {
    const user = await getCurrentUser();
    const events = await syncCalendlyEvents(user.resource.uri);

    const created: any[] = [];
    for (const event of events) {
      if (!event.meeting_url) continue;

      // check if meeting already exists
      const { data: existing } = await supabase
        .from("meetings")
        .select("id")
        .eq("join_url", event.meeting_url)
        .single();

      if (existing) continue;

      const { data: meeting } = await supabase
        .from("meetings")
        .insert({
          title: event.name,
          platform: detectPlatformFromUrl(event.meeting_url),
          join_url: event.meeting_url,
          start_time: event.start_time,
          end_time: event.end_time,
          join_delay_minutes: 2,
          auth_mode: "anonymous",
          camera_off: true,
          mic_off: true,
          attendance_method: "none",
          status: "scheduled",
        })
        .select()
        .single();

      if (meeting) created.push(meeting);
    }

    return c.json({ synced: created.length, meetings: created });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/calendly/webhook
app.post("/webhook", async (c) => {
  const payload = await c.req.json();
  const result = await handleCalendlyWebhook(payload);

  if (result.meeting_url && result.start_time) {
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("join_url", result.meeting_url)
      .single();

    if (!existing) {
      await supabase.from("meetings").insert({
        title: "calendly event",
        platform: detectPlatformFromUrl(result.meeting_url),
        join_url: result.meeting_url,
        start_time: result.start_time,
        join_delay_minutes: 2,
        auth_mode: "anonymous",
        camera_off: true,
        mic_off: true,
        attendance_method: "none",
        status: "scheduled",
      });
    }
  }

  return c.json({ status: "ok" });
});

function detectPlatformFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us")) return "zoom";
  if (lower.includes("meet.google.com")) return "google_meet";
  if (lower.includes("teams.microsoft.com")) return "teams";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("twitch.tv")) return "twitch";
  return "custom";
}

export default app;
