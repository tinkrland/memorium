import { Hono } from "hono";
import {
  scanSubreddit,
  scanDiscourseForum,
  scanMLHEvents,
  scanWebPage,
  createMeetingsFromForumLinks,
} from "../services/forum_links.ts";

const app = new Hono();

// POST /api/forum/reddit
// body: { subreddit: "hackathon" }
app.post("/reddit", async (c) => {
  const body = await c.req.json();
  if (!body.subreddit) return c.json({ error: "subreddit required" }, 400);

  try {
    const links = await scanSubreddit(body.subreddit, { limit: body.limit || 50 });
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/forum/discourse
// body: { forum_url: "https://community.example.com", api_key: "..." }
app.post("/discourse", async (c) => {
  const body = await c.req.json();
  if (!body.forum_url) return c.json({ error: "forum_url required" }, 400);

  try {
    const links = await scanDiscourseForum(body.forum_url, {
      apiKey: body.api_key,
      limit: body.limit || 30,
    });
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /api/forum/mlh
// scans mlh.io for hackathon event links
app.get("/mlh", async (c) => {
  try {
    const links = await scanMLHEvents();
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/forum/scan-page
// body: { url: "https://example.com/event", title: "optional title" }
app.post("/scan-page", async (c) => {
  const body = await c.req.json();
  if (!body.url) return c.json({ error: "url required" }, 400);

  try {
    const links = await scanWebPage(body.url, { title: body.title });
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/forum/create-meetings
// body: { links: [...] }
app.post("/create-meetings", async (c) => {
  const body = await c.req.json();

  if (!body.links || !Array.isArray(body.links)) {
    return c.json({ error: "links array required" }, 400);
  }

  try {
    const created = await createMeetingsFromForumLinks(body.links);
    return c.json({ created });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
