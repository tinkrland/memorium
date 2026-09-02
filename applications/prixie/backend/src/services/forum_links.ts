// forum and community link monitoring service
// monitors community forums, reddit threads, discourse, etc. for meeting links
// useful for hackathons (mlh, devpost), community events, webinars

import { createClient } from "npm:@supabase/supabase-js@2";
import { detectPlatform } from "./calendar_sync.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface ForumLink {
  url: string;
  platform: string;
  source: "forum";
  source_name: string; // reddit, discourse, mlh, devpost, etc.
  thread_url: string;
  thread_title: string;
  post_content: string;
  author: string;
  discovered_at: string;
}

// ============================================================================
// reddit monitoring
// ============================================================================

export async function scanSubreddit(subreddit: string, options?: { limit?: number }): Promise<ForumLink[]> {
  const limit = options?.limit || 25;

  const res = await fetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`, {
    headers: { "User-Agent": "prixie/1.0" },
  });

  if (!res.ok) {
    console.warn(`forum: reddit r/${subreddit} failed:`, res.statusText);
    return [];
  }

  const data = await res.json();
  const posts = data?.data?.children || [];
  const links: ForumLink[] = [];

  for (const post of posts) {
    const p = post.data;
    const text = `${p.title} ${p.selftext || ""} ${p.url || ""}`;
    const foundUrls = extractLinksFromText(text);

    for (const url of foundUrls) {
      links.push({
        url,
        platform: detectPlatform(url),
        source: "forum",
        source_name: `reddit/r/${subreddit}`,
        thread_url: `https://reddit.com${p.permalink}`,
        thread_title: p.title,
        post_content: (p.selftext || "").substring(0, 500),
        author: p.author || "unknown",
        discovered_at: new Date(p.created_utc * 1000).toISOString(),
      });
    }
  }

  await saveLinks(links);
  return links;
}

// ============================================================================
// discourse forum monitoring
// ============================================================================

export async function scanDiscourseForum(
  forumUrl: string,
  options?: { apiKey?: string; limit?: number }
): Promise<ForumLink[]> {
  const limit = options?.limit || 30;
  const headers: Record<string, string> = { "User-Agent": "prixie/1.0" };
  if (options?.apiKey) {
    headers["Api-Key"] = options.apiKey;
    headers["Api-Username"] = "prixie";
  }

  // fetch latest topics
  const res = await fetch(`${forumUrl}/latest.json?per_page=${limit}`, { headers });

  if (!res.ok) {
    console.warn(`forum: discourse ${forumUrl} failed:`, res.statusText);
    return [];
  }

  const data = await res.json();
  const topics = data?.topic_list?.topics || [];
  const links: ForumLink[] = [];

  for (const topic of topics) {
    // fetch the topic content
    const topicRes = await fetch(`${forumUrl}/t/${topic.id}.json`, { headers });
    if (!topicRes.ok) continue;
    const topicData = await topicRes.json();

    // search posts in the topic
    for (const post of topicData.post_stream?.posts || []) {
      const text = `${post.cooked || ""}`.replace(/<[^>]+>/g, " ");
      const foundUrls = extractLinksFromText(text);

      for (const url of foundUrls) {
        links.push({
          url,
          platform: detectPlatform(url),
          source: "forum",
          source_name: new URL(forumUrl).hostname,
          thread_url: `${forumUrl}/t/${topic.id}`,
          thread_title: topic.title || "untitled",
          post_content: text.substring(0, 500),
          author: post.username || "unknown",
          discovered_at: topic.created_at || new Date().toISOString(),
        });
      }
    }
  }

  await saveLinks(links);
  return links;
}

// ============================================================================
// mlh / hackathon monitoring
// ============================================================================

export async function scanMLHEvents(): Promise<ForumLink[]> {
  // MLH hackathon schedules often have event links
  // this monitors the MLH events API/page for meeting links
  try {
    const res = await fetch("https://mlh.io/seasons/2026/events", {
      headers: { "User-Agent": "prixie/1.0" },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const links: ForumLink[] = [];
    const foundUrls = extractLinksFromText(html);

    for (const url of foundUrls) {
      links.push({
        url,
        platform: detectPlatform(url),
        source: "forum",
        source_name: "mlh.io",
        thread_url: "https://mlh.io/seasons/2026/events",
        thread_title: "MLH 2026 season events",
        post_content: "",
        author: "mlh",
        discovered_at: new Date().toISOString(),
      });
    }

    await saveLinks(links);
    return links;
  } catch {
    return [];
  }
}

// ============================================================================
// generic web page monitoring
// ============================================================================

export async function scanWebPage(pageUrl: string, options?: {
  selector?: string;
  title?: string;
}): Promise<ForumLink[]> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "prixie/1.0" },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const links: ForumLink[] = [];
    const foundUrls = extractLinksFromText(html);

    for (const url of foundUrls) {
      links.push({
        url,
        platform: detectPlatform(url),
        source: "forum",
        source_name: new URL(pageUrl).hostname,
        thread_url: pageUrl,
        thread_title: options?.title || `links from ${new URL(pageUrl).hostname}`,
        post_content: "",
        author: "web",
        discovered_at: new Date().toISOString(),
      });
    }

    await saveLinks(links);
    return links;
  } catch {
    return [];
  }
}

// ============================================================================
// utilities
// ============================================================================

function extractLinksFromText(text: string): string[] {
  const patterns = [
    /https:\/\/[a-z0-9-]+\.zoom\.us\/[^\s<>"'<>]+/gi,
    /https:\/\/meet\.google\.com\/[^\s<>"'<>]+/gi,
    /https:\/\/teams\.microsoft\.com\/[^\s<>"'<>]+/gi,
    /https:\/\/discord\.gg\/[^\s<>"'<>]+/gi,
    /https:\/\/discord\.com\/(channels|invite)\/[^\s<>"'<>]+/gi,
    /https:\/\/[a-z0-9-]+\.bluejeans\.com\/[^\s<>"'<>]+/gi,
    /https:\/\/[a-z0-9-]+\.ringcentral\.com\/[^\s<>"'<>]+/gi,
    /https:\/\/[a-z0-9-]+\.webex\.com\/[^\s<>"'<>]+/gi,
    /https:\/\/twitch\.tv\/[^\s<>"'<>]+/gi,
    /https:\/\/[a-z0-9-]+\.zoomgov\.com\/[^\s<>"'<>]+/gi,
  ];

  const urls = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      urls.add(match.replace(/[.,;:!?)]+>$/, ""));
    }
  }

  return Array.from(urls);
}

async function saveLinks(links: ForumLink[]): Promise<void> {
  for (const link of links) {
    const { error } = await supabase
      .from("link_sources")
      .upsert({
        url: link.url,
        platform: link.platform,
        source: "forum",
        source_channel: link.source_name,
        source_message_id: link.thread_url,
        discovered_at: link.discovered_at,
        status: "discovered",
      }, { onConflict: "url" });

    if (error) console.warn("forum: failed to save:", error);
  }
}

// auto-create meetings from forum links
export async function createMeetingsFromForumLinks(links: ForumLink[]): Promise<number> {
  let created = 0;

  for (const link of links) {
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("join_url", link.url)
      .single();

    if (existing) continue;

    const startTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: meeting } = await supabase
      .from("meetings")
      .insert({
        title: link.thread_title || `forum link from ${link.source_name}`,
        platform: link.platform,
        join_url: link.url,
        start_time: startTime,
        join_delay_minutes: 2,
        auth_mode: "anonymous",
        camera_off: true,
        mic_off: true,
        attendance_method: "none",
        source: "discord", // maps to "forum" conceptually
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
