// multi calendar sync service
// supports google calendar, microsoft outlook, notion calendar, apple calendar
// each calendar source has its own adapter but they all produce the same MeetingCandidate format

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export type CalendarSource = "google" | "outlook" | "notion" | "apple" | "calendly" | "luma";

export interface MeetingCandidate {
  title: string;
  start_time: string;
  end_time?: string;
  join_url?: string;
  platform?: string;
  source: CalendarSource;
  source_event_id: string;
  timezone?: string;
  raw_location?: string;
}

// --- google calendar (existing, enhanced) ---

export async function syncGoogleCalendar(calendarId: string): Promise<MeetingCandidate[]> {
  const { data: syncState } = await supabase
    .from("sync_states")
    .select("*")
    .eq("calendar_id", calendarId)
    .single();

  const now = new Date();
  const timeMin = syncState?.last_synced || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const accessToken = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN");
  if (!accessToken) return [];

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();

  const candidates: MeetingCandidate[] = [];
  for (const event of data.items || []) {
    const joinUrl = extractMeetingUrl(event.location || "", event.hangoutLink || "");
    const platform = detectPlatform(joinUrl || event.location || "");

    candidates.push({
      title: event.summary || "untitled event",
      start_time: event.start?.dateTime || event.start?.date,
      end_time: event.end?.dateTime || event.end?.date,
      join_url: joinUrl,
      platform,
      source: "google",
      source_event_id: event.id,
      timezone: event.start?.timeZone,
      raw_location: event.location,
    });
  }

  // update sync state
  await supabase.from("sync_states").upsert({
    calendar_id: calendarId,
    sync_token: data.nextSyncToken,
    last_synced: now.toISOString(),
  });

  return candidates;
}

// --- microsoft outlook calendar ---

export async function syncOutlookCalendar(accessToken: string): Promise<MeetingCandidate[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startOfDay}&endDateTime=${endOfWeek}&$select=subject,start,end,location,onlineMeeting`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];
  const data = await res.json();

  const candidates: MeetingCandidate[] = [];
  for (const event of data.value || []) {
    const joinUrl = event.onlineMeeting?.joinUrl || extractMeetingUrl(event.location?.displayName || "");
    const platform = detectPlatform(joinUrl || event.location?.displayName || "");

    candidates.push({
      title: event.subject || "untitled event",
      start_time: event.start?.dateTime,
      end_time: event.end?.dateTime,
      join_url: joinUrl,
      platform,
      source: "outlook",
      source_event_id: event.id,
      timezone: event.start?.timeZone,
      raw_location: event.location?.displayName,
    });
  }

  return candidates;
}

// --- notion calendar (via notion api) ---

export async function syncNotionCalendar(databaseId: string, accessToken: string): Promise<MeetingCandidate[]> {
  const now = new Date().toISOString();
  const oneWeekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Date", date: { on_or_after: now } },
          { property: "Date", date: { on_or_before: oneWeekAhead } },
        ],
      },
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();

  const candidates: MeetingCandidate[] = [];
  for (const page of data.results || []) {
    const props = page.properties || {};
    const title = props.Name?.title?.[0]?.plain_text || props.Title?.title?.[0]?.plain_text || "untitled";
    const date = props.Date?.date;
    const location = props.Location?.rich_text?.[0]?.plain_text || props.Link?.url || "";
    const joinUrl = extractMeetingUrl(location);

    candidates.push({
      title,
      start_time: date?.start,
      end_time: date?.end,
      join_url: joinUrl,
      platform: detectPlatform(joinUrl || location),
      source: "notion",
      source_event_id: page.id,
      raw_location: location,
    });
  }

  return candidates;
}

// --- apple calendar (via caldav) ---

export async function syncAppleCalendar(serverUrl: string, username: string, password: string): Promise<MeetingCandidate[]> {
  // apple calendar uses caldav. this is a simplified implementation.
  // for production, use a caldav library like tsdav or caldav-client

  const auth = btoa(`${username}:${password}`);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // caldav report query
  const caldavBody = `<?xml version="1.0" encoding="utf-8"?>
    <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
      <d:prop>
        <d:getetag />
        <c:calendar-data />
      </d:prop>
      <c:filter>
        <c:comp-filter name="VCALENDAR">
          <c:comp-filter name="VEVENT">
            <c:time-range start="${startOfDay.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}" end="${endOfWeek.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}" />
          </c:comp-filter>
        </c:comp-filter>
      </c:filter>
    </c:calendar-query>`;

  try {
    const res = await fetch(serverUrl, {
      method: "REPORT",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/xml; charset=utf-8",
        "Depth": "1",
      },
      body: caldavBody,
    });

    if (!res.ok) return [];

    // parse caldav response (simplified - would need ical parsing)
    const text = await res.text();
    const candidates: MeetingCandidate[] = [];

    // extract VEVENT blocks and parse them
    // this is a simplified parser - for production use ical.js or node-ical
    const events = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

    for (const eventText of events) {
      const summary = eventText.match(/SUMMARY:(.*)/)?.[1] || "untitled";
      const dtstart = eventText.match(/DTSTART[^:]*:(.*)/)?.[1];
      const dtend = eventText.match(/DTEND[^:]*:(.*)/)?.[1];
      const location = eventText.match(/LOCATION:(.*)/)?.[1] || "";
      const description = eventText.match(/DESCRIPTION:(.*)/)?.[1] || "";

      const joinUrl = extractMeetingUrl(location) || extractMeetingUrl(description);

      candidates.push({
        title: summary,
        start_time: dtstart ? parseICalDate(dtstart) : undefined,
        end_time: dtend ? parseICalDate(dtend) : undefined,
        join_url: joinUrl,
        platform: detectPlatform(joinUrl || location),
        source: "apple",
        source_event_id: eventText.match(/UID:(.*)/)?.[1] || "",
        raw_location: location,
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

function parseICalDate(dateStr: string): string {
  // basic iCal date parsing
  const cleaned = dateStr.replace(/^[T]/, "");
  if (cleaned.length === 8) {
    // date only: YYYYMMDD
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00Z`;
  }
  // datetime: YYYYMMDDTHHMMSSZ
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}:${cleaned.slice(13, 15)}Z`;
}

// --- shared utilities ---

export function extractMeetingUrl(text: string, hangoutLink?: string): string | undefined {
  if (hangoutLink) return hangoutLink;

  if (!text) return undefined;

  const patterns = [
    /https:\/\/[a-z0-9-]+\.zoom\.us\/[^\s]+/i,
    /https:\/\/meet\.google\.com\/[^\s]+/i,
    /https:\/\/teams\.microsoft\.com\/[^\s]+/i,
    /https:\/\/discord\.gg\/[^\s]+/i,
    /https:\/\/discord\.com\/[^\s]+/i,
    /https:\/\/[a-z0-9-]+\.bluejeans\.com\/[^\s]+/i,
    /https:\/\/[a-z0-9-]+\.ringcentral\.com\/[^\s]+/i,
    /https:\/\/[a-z0-9-]+\.webex\.com\/[^\s]+/i,
    /https:\/\/twitch\.tv\/[^\s]+/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return undefined;
}

export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us")) return "zoom";
  if (lower.includes("meet.google.com")) return "google_meet";
  if (lower.includes("teams.microsoft.com")) return "teams";
  if (lower.includes("discord.gg") || lower.includes("discord.com")) return "discord";
  if (lower.includes("bluejeans.com")) return "bluejeans";
  if (lower.includes("ringcentral.com")) return "ringcentral";
  if (lower.includes("webex.com")) return "webex";
  if (lower.includes("twitch.tv")) return "twitch";
  return "custom";
}

// --- unified sync ---

export async function syncAllCalendars(config: {
  google?: { calendarId: string };
  outlook?: { accessToken: string };
  notion?: { databaseId: string; accessToken: string };
  apple?: { serverUrl: string; username: string; password: string };
}): Promise<MeetingCandidate[]> {
  const all: MeetingCandidate[] = [];

  if (config.google) {
    try {
      const g = await syncGoogleCalendar(config.google.calendarId);
      all.push(...g);
    } catch (e) { console.warn("google calendar sync failed:", e); }
  }

  if (config.outlook) {
    try {
      const o = await syncOutlookCalendar(config.outlook.accessToken);
      all.push(...o);
    } catch (e) { console.warn("outlook calendar sync failed:", e); }
  }

  if (config.notion) {
    try {
      const n = await syncNotionCalendar(config.notion.databaseId, config.notion.accessToken);
      all.push(...n);
    } catch (e) { console.warn("notion calendar sync failed:", e); }
  }

  if (config.apple) {
    try {
      const a = await syncAppleCalendar(config.apple.serverUrl, config.apple.username, config.apple.password);
      all.push(...a);
    } catch (e) { console.warn("apple calendar sync failed:", e); }
  }

  // deduplicate by source_event_id
  const seen = new Set<string>();
  return all.filter(c => {
    const key = `${c.source}:${c.source_event_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
