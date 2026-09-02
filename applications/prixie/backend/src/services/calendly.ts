// calendly integration service
// syncs calendly events and extracts meeting links

const CALENDLY_API_KEY = Deno.env.get("CALENDLY_API_KEY") || "";
const CALENDLY_BASE = "https://api.calendly.com";

export interface CalendlyEvent {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  location: string;
  location_type: string;
  meeting_url?: string;
  invitee_email?: string;
  status: string;
}

// get current user
export async function getCurrentUser(): Promise<any> {
  const res = await fetch(`${CALENDLY_BASE}/users/me`, {
    headers: { "Authorization": `Bearer ${CALENDLY_API_KEY}` },
  });
  if (!res.ok) throw new Error(`calendly auth failed: ${res.statusText}`);
  return res.json();
}

// list scheduled events (invites)
export async function listEvents(options?: {
  user?: string;
  status?: "active" | "canceled";
  min_start_time?: string;
  max_start_time?: string;
}): Promise<CalendlyEvent[]> {
  const params = new URLSearchParams();
  if (options?.user) params.set("user", options.user);
  if (options?.status) params.set("status", options.status);
  if (options?.min_start_time) params.set("min_start_time", options.min_start_time);
  if (options?.max_start_time) params.set("max_start_time", options.max_start_time);

  const res = await fetch(`${CALENDLY_BASE}/scheduled_events?${params}`, {
    headers: { "Authorization": `Bearer ${CALENDLY_API_KEY}` },
  });
  if (!res.ok) throw new Error(`calendly list failed: ${res.statusText}`);
  const data = await res.json();

  return (data.collection || []).map((e: any) => {
    const location = e.location || {};
    return {
      id: e.id,
      name: e.name,
      start_time: e.start_time,
      end_time: e.end_time,
      location: location.location || "",
      location_type: location.type || "",
      meeting_url: location.join_url,
      status: e.status,
    };
  });
}

// get event invitee details (email, name)
export async function getEventInvitees(eventId: string): Promise<any[]> {
  const res = await fetch(`${CALENDLY_BASE}/scheduled_events/${eventId}/invitees`, {
    headers: { "Authorization": `Bearer ${CALENDLY_API_KEY}` },
  });
  if (!res.ok) throw new Error(`calendly invitees failed: ${res.statusText}`);
  const data = await res.json();
  return data.collection || [];
}

// sync events to supabase meetings
export async function syncCalendlyEvents(userId: string): Promise<CalendlyEvent[]> {
  const now = new Date().toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const events = await listEvents({
    user: userId,
    status: "active",
    min_start_time: oneWeekAgo,
    max_start_time: oneWeekAhead,
  });

  return events;
}

// webhook handler for calendly events
export async function handleCalendlyWebhook(payload: any): Promise<{
  event: string;
  meeting_url?: string;
  start_time?: string;
}> {
  const event = payload.event;
  const payloadData = payload.payload || {};

  const location = payloadData.event?.location || {};
  const meetingUrl = location.join_url;

  return {
    event,
    meeting_url: meetingUrl,
    start_time: payloadData.event?.start_time,
  };
}
