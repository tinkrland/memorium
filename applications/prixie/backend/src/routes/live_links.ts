import { Hono } from "hono";
import {
  scanDiscordChannels,
  scanSlackChannels,
  createMeetingsFromLiveLinks,
} from "../services/live_links.ts";

const app = new Hono();

// POST /api/live-links/discord
// body: { bot_token, channel_ids: ["123", "456"] }
app.post("/discord", async (c) => {
  const body = await c.req.json();
  const botToken = body.bot_token || Deno.env.get("DISCORD_BOT_TOKEN");

  if (!botToken) return c.json({ error: "discord bot token required" }, 400);
  if (!body.channel_ids || !Array.isArray(body.channel_ids)) {
    return c.json({ error: "channel_ids array required" }, 400);
  }

  try {
    const links = await scanDiscordChannels(botToken, body.channel_ids);
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/live-links/slack
// body: { bot_token, channel_ids: ["C123", "C456"] }
app.post("/slack", async (c) => {
  const body = await c.req.json();
  const botToken = body.bot_token || Deno.env.get("SLACK_BOT_TOKEN");

  if (!botToken) return c.json({ error: "slack bot token required" }, 400);
  if (!body.channel_ids || !Array.isArray(body.channel_ids)) {
    return c.json({ error: "channel_ids array required" }, 400);
  }

  try {
    const links = await scanSlackChannels(botToken, body.channel_ids);
    return c.json({ scanned: links.length, links });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/live-links/create-meetings
// body: { links: [...] }
// auto-creates meeting records from discovered live links
app.post("/create-meetings", async (c) => {
  const body = await c.req.json();

  if (!body.links || !Array.isArray(body.links)) {
    return c.json({ error: "links array required" }, 400);
  }

  try {
    const created = await createMeetingsFromLiveLinks(body.links);
    return c.json({ created });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST /api/live-links/scan-all
// body: { discord_token, slack_token, discord_channels, slack_channels }
// scans all configured channels and auto-creates meetings
app.post("/scan-all", async (c) => {
  const body = await c.req.json();
  const allLinks: any[] = [];

  if (body.discord_token && body.discord_channels) {
    try {
      const links = await scanDiscordChannels(body.discord_token, body.discord_channels);
      allLinks.push(...links);
    } catch (err) {
      console.warn("discord scan failed:", err);
    }
  }

  if (body.slack_token && body.slack_channels) {
    try {
      const links = await scanSlackChannels(body.slack_token, body.slack_channels);
      allLinks.push(...links);
    } catch (err) {
      console.warn("slack scan failed:", err);
    }
  }

  const created = await createMeetingsFromLiveLinks(allLinks);

  return c.json({ total_links: allLinks.length, meetings_created: created });
});

export default app;
