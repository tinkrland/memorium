import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { searchEvents, getEvent, registerForEvent, registerAndCreateMeeting } from "../services/luma.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const app = new Hono();

// GET /api/luma/search?query=hackathon
app.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) return c.json({ error: "query required" }, 400);
  try {
    const events = await searchEvents(query);
    return c.json(events);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/luma/event/:id
app.get("/event/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const event = await getEvent(id);
    return c.json(event);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/luma/register
// body: { event_id, profile_id }
app.post("/register", async (c) => {
  const body = await c.req.json();
  const { event_id, profile_id } = body;

  if (!event_id) return c.json({ error: "event_id required" }, 400);

  // get profile data
  let profileData = { name: "prixie", email: "prixie@proxy.local", display_name: "prixie" };
  if (profile_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile_id)
      .single();
    if (profile) {
      profileData = {
        name: profile.name,
        email: profile.email || "prixie@proxy.local",
        display_name: profile.display_name || profile.name,
      };
    }
  }

  try {
    const { registration, event } = await registerAndCreateMeeting(event_id, profileData);

    // create meeting record in supabase if we got a meeting url
    if (event.meeting_url) {
      const { data: meeting } = await supabase
        .from("meetings")
        .insert({
          title: event.title,
          platform: detectPlatformFromUrl(event.meeting_url),
          join_url: event.meeting_url,
          start_time: event.start_at,
          end_time: event.end_at,
          join_delay_minutes: 2,
          auth_mode: "anonymous",
          camera_off: true,
          mic_off: true,
          attendance_method: "none",
          profile_id: profile_id || null,
          status: "scheduled",
        })
        .select()
        .single();

      return c.json({ registration, event, meeting });
    }

    return c.json({ registration, event });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

function detectPlatformFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us")) return "zoom";
  if (lower.includes("meet.google.com")) return "google_meet";
  if (lower.includes("teams.microsoft.com")) return "teams";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("bluejeans.com")) return "bluejeans";
  if (lower.includes("ringcentral.com")) return "ringcentral";
  if (lower.includes("webex.com")) return "webex";
  if (lower.includes("twitch.tv")) return "twitch";
  return "custom";
}

export default app;
