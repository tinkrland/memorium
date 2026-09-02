// inbox monitoring service
// monitors gmail for meeting links in emails
// parses email body for zoom, google meet, teams, discord, etc. join links
// creates link_source records and optionally auto-creates meeting records

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractMeetingUrl, detectPlatform } from "./calendar_sync.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export interface InboxLink {
  email_id: string;
  email_subject: string;
  email_from: string;
  email_date: string;
  url: string;
  platform: string;
  body_snippet: string;
}

// fetch recent emails and search for meeting links
export async function scanInbox(accessToken: string, options?: {
  maxResults?: number;
  query?: string;
}): Promise<InboxLink[]> {
  const maxResults = options?.maxResults || 50;
  // search for emails likely to contain meeting links
  const query = options?.query || 'subject:(meeting OR invite OR join OR call OR zoom OR "google meet" OR teams OR event) newer_than:7d';

  // 1. list messages matching query
  const listRes = await fetch(
    `${GMAIL_API_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    console.warn("inbox: gmail list failed:", listRes.statusText);
    return [];
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  const links: InboxLink[] = [];

  // 2. fetch each message and extract links
  for (const msg of messages) {
    try {
      const msgRes = await fetch(
        `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=full`,
        { headers: { "Authorization": `Bearer ${accessToken}` } }
      );

      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      // extract subject, from, date
      const headers = msgData.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
      const from = headers.find((h: any) => h.name === "From")?.value || "";
      const date = headers.find((h: any) => h.name === "Date")?.value || "";

      // extract body text
      const bodyText = extractEmailBody(msgData.payload);

      // search for meeting links in body and subject
      const fullText = `${subject}\n${bodyText}`;
      const foundUrls = findAllMeetingUrls(fullText);

      for (const url of foundUrls) {
        const platform = detectPlatform(url);
        const snippet = extractSnippet(bodyText, url, 100);

        links.push({
          email_id: msg.id,
          email_subject: subject,
          email_from: from,
          email_date: date,
          url,
          platform,
          body_snippet: snippet,
        });
      }
    } catch (err) {
      console.warn(`inbox: failed to process message ${msg.id}:`, err);
    }
  }

  // 3. save to link_sources table
  for (const link of links) {
    const { error } = await supabase
      .from("link_sources")
      .upsert({
        url: link.url,
        platform: link.platform,
        source: "gmail",
        source_message_id: link.email_id,
        discovered_at: new Date().toISOString(),
        status: "discovered",
      }, { onConflict: "url" });

    if (error) console.warn("inbox: failed to save link_source:", error);
  }

  return links;
}

// extract plain text body from gmail message payload
function extractEmailBody(payload: any): string {
  if (!payload) return "";

  // direct body
  if (payload.body?.data) {
    try {
      return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return "";
    }
  }

  // multipart
  if (payload.parts) {
    // prefer text/plain
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      try {
        return atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      } catch {
        return "";
      }
    }

    // fallback to text/html (strip tags)
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      try {
        const html = atob(htmlPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      } catch {
        return "";
      }
    }

    // recurse into nested parts
    for (const part of payload.parts) {
      const body = extractEmailBody(part);
      if (body) return body;
    }
  }

  return "";
}

// find all meeting URLs in text
function findAllMeetingUrls(text: string): string[] {
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
      // clean trailing punctuation
      urls.add(match.replace(/[.,;:!?)]+$/, ""));
    }
  }

  return Array.from(urls);
}

// extract a snippet of text around a URL
function extractSnippet(text: string, url: string, length: number): string {
  const idx = text.indexOf(url);
  if (idx === -1) return "";

  const start = Math.max(0, idx - length / 2);
  const end = Math.min(text.length, idx + url.length + length / 2);
  return text.substring(start, end).trim();
}

// auto-create meeting records from discovered inbox links
export async function createMeetingsFromInbox(accessToken: string): Promise<{
  scanned: number;
  created: number;
  links: InboxLink[];
}> {
  const links = await scanInbox(accessToken);
  let created = 0;

  for (const link of links) {
    // check if meeting already exists with this URL
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("join_url", link.url)
      .single();

    if (existing) continue;

    // try to extract start time from email subject or body
    const startTime = extractTimeFromEmail(link.email_subject, link.email_date);

    const { data: meeting } = await supabase
      .from("meetings")
      .insert({
        title: link.email_subject || "meeting from inbox",
        platform: link.platform,
        join_url: link.url,
        start_time: startTime,
        join_delay_minutes: 2,
        auth_mode: "anonymous",
        camera_off: true,
        mic_off: true,
        attendance_method: "none",
        source: "gmail",
        status: "scheduled",
      })
      .select()
      .single();

    if (meeting) {
      created++;
      // update link_source status
      await supabase
        .from("link_sources")
        .update({ meeting_id: meeting.id, status: "matched" })
        .eq("url", link.url);
    }
  }

  return { scanned: links.length, created, links };
}

// try to extract a start time from email subject/date
function extractTimeFromEmail(subject: string, emailDate: string): string {
  // try subject patterns: "meeting at 3pm", "call tomorrow at 10am", etc.
  const timeMatch = subject.match(/(\d{1,2})[:\s]?(\d{2})?\s*(am|pm)/i);
  const dateFromEmail = new Date(emailDate);

  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3].toLowerCase();

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    dateFromEmail.setHours(hours, minutes, 0, 0);
    return dateFromEmail.toISOString();
  }

  // default: 24 hours from email date
  dateFromEmail.setHours(dateFromEmail.getHours() + 24);
  return dateFromEmail.toISOString();
}
