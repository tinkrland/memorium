import { Hono } from "hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import { scanInbox, createMeetingsFromInbox } from "../services/inbox.ts";

const app = new Hono();

// POST /api/inbox/scan
// body: { access_token }
// scans gmail inbox for meeting links
app.post("/scan", async (c) => {
  const body = await c.req.json();
  const accessToken = body.access_token || Deno.env.get("GMAIL_ACCESS_TOKEN");

  if (!accessToken) return c.json({ error: "gmail access token required" }, 400);

  try {
    const links = await scanInbox(accessToken);
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/inbox/create-meetings
// body: { access_token }
// scans inbox and auto-creates meeting records from discovered links
app.post("/create-meetings", async (c) => {
  const body = await c.req.json();
  const accessToken = body.access_token || Deno.env.get("GMAIL_ACCESS_TOKEN");

  if (!accessToken) return c.json({ error: "gmail access token required" }, 400);

  try {
    const result = await createMeetingsFromInbox(accessToken);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
