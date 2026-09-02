import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  Meeting,
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingStatus,
  CaptureRequest,
  CreateCaptureRequestInput,
  UpdateCaptureRequestInput,
  Transcript,
  AttendanceMessage,
  MessageTrigger,
  MessageSentStatus,
} from "../types.ts";

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !key) {
    console.warn("prixie: warning - SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
  }

  supabaseInstance = createClient(url || "https://placeholder.supabase.co", key || "placeholder");
  return supabaseInstance;
}

// -----------------------------------------------------------------------------
// Meetings CRUD
// -----------------------------------------------------------------------------

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .insert([
      {
        title: input.title,
        platform: input.platform || detectPlatformFromUrl(input.join_url),
        join_url: input.join_url,
        start_time: input.start_time,
        end_time: input.end_time || null,
        instruction: input.instruction || null,
        join_delay_minutes: input.join_delay_minutes !== undefined ? input.join_delay_minutes : 2,
        attendance_method: input.attendance_method || "none",
        attendance_form_url: input.attendance_form_url || null,
        zoom_user_email: input.zoom_user_email || null,
        status: "scheduled",
        prixie_attended: false,
        attendance_messages_sent: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("prixie: failed to create meeting in supabase", error);
    throw new Error(`failed to create meeting: ${error.message}`);
  }

  return data as Meeting;
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error(`prixie: error fetching meeting ${id}`, error);
    return null;
  }

  return data as Meeting;
}

export async function getMeetingByBotId(botId: string): Promise<Meeting | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error(`prixie: error fetching meeting by bot_id ${botId}`, error);
    return null;
  }

  return data as Meeting;
}

export async function listMeetings(status?: MeetingStatus): Promise<Meeting[]> {
  const supabase = getSupabase();
  let query = supabase.from("meetings").select("*").order("start_time", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("prixie: failed to list meetings", error);
    throw new Error(`failed to list meetings: ${error.message}`);
  }

  return (data || []) as Meeting[];
}

export async function updateMeeting(id: string, updates: UpdateMeetingInput): Promise<Meeting | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`prixie: failed to update meeting ${id}`, error);
    throw new Error(`failed to update meeting: ${error.message}`);
  }

  return data as Meeting;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("meetings").delete().eq("id", id);

  if (error) {
    console.error(`prixie: failed to delete meeting ${id}`, error);
    return false;
  }

  return true;
}

export async function getScheduledUpcomingMeetings(windowMinutes = 5): Promise<Meeting[]> {
  const supabase = getSupabase();
  const now = new Date();
  const futureWindow = new Date(now.getTime() + windowMinutes * 60 * 1000);

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("status", "scheduled")
    .lte("start_time", futureWindow.toISOString())
    .order("start_time", { ascending: true });

  if (error) {
    console.error("prixie: failed to fetch scheduled upcoming meetings", error);
    return [];
  }

  return (data || []) as Meeting[];
}

export async function getActiveMeetings(): Promise<Meeting[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .in("status", ["bot_joining", "bot_in_meeting"]);

  if (error) {
    console.error("prixie: failed to fetch active meetings", error);
    return [];
  }

  return (data || []) as Meeting[];
}

export async function getCompletedMeetingsWithoutTranscript(): Promise<Meeting[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("status", "completed")
    .is("transcript_id", null);

  if (error) {
    console.error("prixie: failed to fetch completed meetings without transcript", error);
    return [];
  }

  return (data || []) as Meeting[];
}

// -----------------------------------------------------------------------------
// Capture Requests CRUD
// -----------------------------------------------------------------------------

export async function createCaptureRequest(input: CreateCaptureRequestInput): Promise<CaptureRequest> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .insert([
      {
        meeting_id: input.meeting_id,
        title: input.title,
        type: input.type,
        keywords: input.keywords || [],
        notes: input.notes || null,
        question: input.question || null,
        screenshot_enabled: input.screenshot_enabled ?? false,
        check_chat: input.check_chat ?? true,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("prixie: failed to create capture request", error);
    throw new Error(`failed to create capture request: ${error.message}`);
  }

  return data as CaptureRequest;
}

export async function getCaptureRequestById(id: string): Promise<CaptureRequest | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as CaptureRequest;
}

export async function getCaptureRequestsByMeeting(meetingId: string): Promise<CaptureRequest[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`prixie: failed to fetch capture requests for meeting ${meetingId}`, error);
    return [];
  }

  return (data || []) as CaptureRequest[];
}

export async function getPendingCaptureRequestsByMeeting(meetingId: string): Promise<CaptureRequest[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("status", "pending");

  if (error) {
    console.error(`prixie: failed to fetch pending capture requests for meeting ${meetingId}`, error);
    return [];
  }

  return (data || []) as CaptureRequest[];
}

export async function listCaptureRequests(): Promise<CaptureRequest[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("prixie: failed to list capture requests", error);
    return [];
  }

  return (data || []) as CaptureRequest[];
}

export async function updateCaptureRequest(id: string, updates: UpdateCaptureRequestInput): Promise<CaptureRequest | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("capture_requests")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`prixie: failed to update capture request ${id}`, error);
    throw new Error(`failed to update capture request: ${error.message}`);
  }

  return data as CaptureRequest;
}

export async function deleteCaptureRequest(id: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("capture_requests").delete().eq("id", id);
  if (error) return false;
  return true;
}

// -----------------------------------------------------------------------------
// Transcripts CRUD
// -----------------------------------------------------------------------------

export async function createTranscript(input: {
  meeting_id: string;
  full_transcript: string;
  summary?: string;
  action_items?: string[];
  captured_items?: Record<string, unknown>;
}): Promise<Transcript> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transcripts")
    .insert([
      {
        meeting_id: input.meeting_id,
        full_transcript: input.full_transcript,
        summary: input.summary || null,
        action_items: input.action_items || [],
        captured_items: input.captured_items || {},
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("prixie: failed to create transcript record", error);
    throw new Error(`failed to create transcript: ${error.message}`);
  }

  const transcript = data as Transcript;

  // Link transcript back to meeting
  await updateMeeting(input.meeting_id, { transcript_id: transcript.id });

  return transcript;
}

export async function getTranscriptByMeetingId(meetingId: string): Promise<Transcript | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transcripts")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error(`prixie: error fetching transcript for meeting ${meetingId}`, error);
    return null;
  }

  return data as Transcript;
}

export async function updateTranscript(id: string, updates: Partial<Transcript>): Promise<Transcript | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transcripts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return data as Transcript;
}

// -----------------------------------------------------------------------------
// Attendance Messages CRUD
// -----------------------------------------------------------------------------

export async function createAttendanceMessage(input: {
  meeting_id: string;
  message_text: string;
  trigger?: MessageTrigger;
  sent_status?: MessageSentStatus;
  sent_at?: string;
}): Promise<AttendanceMessage> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("attendance_messages")
    .insert([
      {
        meeting_id: input.meeting_id,
        message_text: input.message_text,
        trigger: input.trigger || "on_join",
        sent_status: input.sent_status || "pending",
        sent_at: input.sent_at || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("prixie: failed to create attendance message", error);
    throw new Error(`failed to create attendance message: ${error.message}`);
  }

  return data as AttendanceMessage;
}

export async function getAttendanceMessagesByMeeting(meetingId: string): Promise<AttendanceMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("attendance_messages")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) return [];
  return (data || []) as AttendanceMessage[];
}

export async function updateAttendanceMessage(id: string, updates: Partial<AttendanceMessage>): Promise<AttendanceMessage | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("attendance_messages")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return data as AttendanceMessage;
}

// Helper to infer platform from join URL
function detectPlatformFromUrl(url: string): string {
  if (!url) return "custom";
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us")) return "zoom";
  if (lower.includes("meet.google.com")) return "google_meet";
  if (lower.includes("teams.microsoft.com") || lower.includes("teams.live.com")) return "teams";
  return "custom";
}
