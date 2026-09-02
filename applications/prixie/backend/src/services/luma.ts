// luma event registration service
// prixie registers for events on luma.com and captures the meeting link

const LUMA_API_KEY = Deno.env.get("LUMA_API_KEY") || "";
const LUMA_BASE = "https://api.lu.ma/v1";

export interface LumaEvent {
  id: string;
  title: string;
  start_at: string;
  end_at?: string;
  url: string;
  meeting_url?: string;
  host_name?: string;
  description?: string;
  cover_url?: string;
}

export interface LumaRegistration {
  event_id: string;
  status: "registered" | "waitlist" | "cancelled";
  meeting_url?: string;
}

// search for events by query or host
export async function searchEvents(query: string): Promise<LumaEvent[]> {
  const res = await fetch(`${LUMA_BASE}/event/search?query=${encodeURIComponent(query)}`, {
    headers: { "Authorization": `Bearer ${LUMA_API_KEY}` },
  });
  if (!res.ok) throw new Error(`luma search failed: ${res.statusText}`);
  const data = await res.json();
  return (data.events || []).map((e: any) => ({
    id: e.id,
    title: e.name || e.title,
    start_at: e.start_at || e.start_time,
    end_at: e.end_at || e.end_time,
    url: e.url || e.event_url,
    meeting_url: e.meeting_url || e.join_url,
    host_name: e.host_name,
    description: e.description,
  }));
}

// get event details (including meeting link)
export async function getEvent(eventId: string): Promise<LumaEvent> {
  const res = await fetch(`${LUMA_BASE}/event/get?event=${${eventId}}`, {
    headers: { "Authorization": `Bearer ${LUMA_API_KEY}` },
  });
  if (!res.ok) throw new Error(`luma get event failed: ${res.statusText}`);
  const e = await res.json();
  return {
    id: e.id,
    title: e.name || e.title,
    start_at: e.start_at || e.start_time,
    end_at: e.end_at || e.end_time,
    url: e.url || e.event_url,
    meeting_url: e.meeting_url || e.join_url,
    host_name: e.host_name,
    description: e.description,
  };
}

// register for an event
export async function registerForEvent(
  eventId: string,
  guestData: {
    name: string;
    email: string;
    company?: string;
    jobTitle?: string;
  }
): Promise<LumaRegistration> {
  const res = await fetch(`${LUMA_BASE}/event/register`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LUMA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: eventId,
      guest: {
        name: guestData.name,
        email: guestData.email,
        ...(guestData.company && { company: guestData.company }),
        ...(guestData.jobTitle && { job_title: guestData.jobTitle }),
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`luma registration failed: ${err}`);
  }

  const data = await res.json();

  // after registration, try to get the meeting url
  const event = await getEvent(eventId);

  return {
    event_id: eventId,
    status: "registered",
    meeting_url: event.meeting_url,
  };
}

// register and create a meeting record in supabase
export async function registerAndCreateMeeting(
  eventId: string,
  profileData: { name: string; email: string; display_name: string }
): Promise<{ registration: LumaRegistration; event: LumaEvent }> {
  const reg = await registerForEvent(eventId, {
    name: profileData.display_name || profileData.name,
    email: profileData.email,
  });

  const event = await getEvent(eventId);

  return { registration: reg, event };
}
