// live links monitoring service
// monitors discord and slack channels for meeting links posted in real time
// useful during hackathons, webinars, office hours where links are shared live

import { createClient } from "npm:@supabase/supabase-js@2";
import { detectPlatform } from "./calendar_sync.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface LiveLink {
  url: string;
  platform: string;
  source: "discord" | "slack";
  channel_id: string;
  channel_name: string;
  message_id: string;
  sender: string;
  message_content: string;
  discovered_at: string;
}

// ============================================================================
// discord monitoring
// ============================================================================

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function scanDiscordChannel(
  botToken: string,
  channelId: string,
  options?: { limit?: number; beforeMessageId?: string }
): Promise<LiveLink[]> {
  const limit = options?.limit || 50;
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.beforeMessageId) params.set("before", options.beforeMessageId);

  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages?${params}`, {
    headers: { "Authorization": `Bot ${botToken}` },
  });

  if (!res.ok) {
    console.warn("discord: failed to fetch messages:", res.statusText);
    return [];
  }

  const messages = await res.json();
  const links: LiveLink[] = [];

  for (const msg of messages) {
    const foundUrls = extractLinksFromText(msg.content || "");
    for (const url of foundUrls) {
      links.push({
        url,
        platform: detectPlatform(url),
        source: "discord",
        channel_id: channelId,
        channel_name: msg.channel_id,
        message_id: msg.id,
        sender: msg.author?.username || "unknown",
        message_content: msg.content?.substring(0, 500) || "",
        discovered_at: msg.timestamp || new Date().toISOString(),
      });
    }
  }

  await saveLinks(links);
  return links;
}

// monitor multiple discord channels
export async function scanDiscordChannels(
  botToken: string,
  channelIds: string[]
): Promise<LiveLink[]> {
  const all: LiveLink[] = [];
  for (const channelId of channelIds) {
    try {
      const links = await scanDiscordChannel(botToken, channelId, { limit: 100 });
      all.push(...links);
    } catch (err) {
      console.warn(`discord: error scanning channel ${channelId}:`, err);
    }
  }
  return all;
}

// ============================================================================
// slack monitoring
// ============================================================================

const SLACK_API_BASE = "https://slack.com/api";

export async function scanSlackChannel(
  botToken: string,
  channelId: string,
  options?: { limit?: number; oldest?: string }
): Promise<LiveLink[]> {
  const limit = options?.limit || 100;

  const res = await fetch(`${SLACK_API_BASE}/conversations.history?channel=${channelId}&limit=${limit}${options?.oldest ? `&oldest=${options.oldest}` : ""}`, {
    headers: { "Authorization": `Bearer ${botToken}` },
  });

  if (!res.ok) {
    console.warn("slack: failed to fetch messages:", res.statusText);
    return [];
  }

  const data = await res.json();
  if (!data.ok) {
    console.warn("slack: api error:", data.error);
    return [];
  }

  const links: LiveLink[] = [];

  for (const msg of data.messages || []) {
    // skip bot messages
    if (msg.subtype === "bot_message") continue;

    const text = msg.text || "";
    const foundUrls = extractLinksFromText(text);

    for (const url of foundUrls) {
      links.push({
        url,
        platform: detectPlatform(url),
        source: "slack",
        channel_id: channelId,
        channel_name: channelId,
        message_id: msg.ts || "",
        sender: msg.username || msg.user || "unknown",
        message_content: text.substring(0, 500),
        discovered_at: msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : new Date().toISOString(),
      });
    }
  }

  await saveLinks(links);
  return links;
}

// monitor multiple slack channels
export async function scanSlackChannels(
  botToken: string,
  channelIds: string[]
): Promise<LiveLink[]> {
  const all: LiveLink[] = [];
  for (const channelId of channelIds) {
    try {
      const links = await scanSlackChannel(botToken, channelId, { limit: 100 });
      all.push(...links);
    } catch (err) {
      console.warn(`slack: error scanning channel ${channelId}:`, err);
    }
  }
  return all;
}

// ============================================================================
// shared utilities
// ============================================================================

function extractLinksFromText(text: string): string[] {
  const patterns = [
    /https:\/\/[a-z0-9-]+\.zoom\.us\/[^\s<>"']+/gi,
    /https:\/\/meet\.google\.com\/[^\s<>"']+/gi,
    /https:\/\/teams\.microsoft\.com\/[^\s<>"']+/gi,
    /https:\/\/discord\.gg\/[^\s<>"']+/gi,
    /https:\/\/discord\.com\/(channels|invite)\/[^\s<>"']+/gi,
    /https:\/\/[a-z0-9-]+\.bluejeans\.com\/[^\s<>"']+/gi,
    /https:\/\/[a-z0-9-]+\.ringcentral\.com\/[^\s<>"']+/gi,
    /https:\/\/[a-z0-9-]+\.webex\.com\/[^\s<>"']+/gi,
    /https:\/\/twitch\.tv\/[^\s<>"']+/gi,
    /https:\/\/[a-z0-9-]+\.zoomgov\.com\/[^\s<>"']+/gi,
  ];

  const urls = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      urls.add(match.replace(/[.,;:!?)]+$/, ""));
    }
  }

  return Array.from(urls);
}

// save links to database
async function saveLinks(links: LiveLink[]): Promise<void> {
  for (const link of links) {
    const { error } = await supabase
      .from("link_sources")
      .upsert({
        url: link.url,
        platform: link.platform,
        source: link.source,
        source_channel: link.channel_id,
        source_message_id: link.message_id,
        discovered_at: link.discovered_at,
        status: "discovered",
      }, { onConflict: "url" });

    if (error) console.warn("live_links: failed to save:", error);
  }
}

// auto-create meeting records from discovered live links
export async function createMeetingsFromLiveLinks(links: LiveLink[]): Promise<number> {
  let created = 0;

  for (const link of links) {
    // check if meeting already exists
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("join_url", link.url)
      .single();

    if (existing) continue;

    // live links are often for meetings happening NOW
    // set start time to 2 minutes from now (so bot joins quickly)
    const startTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const { data: meeting } = await supabase
      .from("meetings")
      .insert({
        title: `live link from ${link.source}`,
        platform: link.platform,
        join_url: link.url,
        start_time: startTime,
        join_delay_minutes: 0, // join ASAP for live links
        auth_mode: "anonymous",
        camera_off: true,
        mic_off: true,
        attendance_method: "none",
        source: link.source,
        status: "scheduled",
      })
      .select()
      .single();

    if (meeting) {
      created++;
      await supabase
        .from("link_sources")
        .update({ meeting_id: meeting.id, status: "matched" })
        .eq("url", link.url);
    }
  }

  return created;
}
