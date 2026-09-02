export type PlatformType = 'zoom' | 'google_meet' | 'teams' | 'custom';
export type MeetingStatus = 'scheduled' | 'bot_joining' | 'bot_in_meeting' | 'completed' | 'failed';
export type AttendanceMethod = 'chat_message' | 'google_form' | 'custom' | 'none';
export type CaptureType = 'capture' | 'ask';
export type CaptureStatus = 'pending' | 'captured' | 'answered' | 'not_found' | 'meeting_skipped';
export type MessageTrigger = 'on_join' | 'after_delay' | 'scheduled';
export type MessageSentStatus = 'pending' | 'sent' | 'failed';
export type AuthMode = 'anonymous' | 'signed_in' | 'registration';
export type BreakoutRoomMode = 'auto_accept_all_invites' | 'join_main_room' | 'join_specific_room';

// profile/persona — sandboxed identity per context (hackathon vs professional vs personal)
export interface Profile {
  id: string;
  name: string;                    // internal slug, e.g. "hackathon", "professional"
  display_name: string;            // name shown in meetings (may not be legal name)
  email: string | null;            // email for zoom registration/webinars
  context: string | null;          // instructions/context for this persona
  shared_memory: boolean;          // whether this profile shares global memory or is sandboxed
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  platform: PlatformType | string;
  join_url: string;
  start_time: string;
  end_time?: string | null;
  status: MeetingStatus;
  bot_id?: string | null;
  instruction?: string | null;
  join_delay_minutes: number;
  attendance_method: AttendanceMethod;
  attendance_form_url?: string | null;
  zoom_user_email?: string | null;
  prixie_attended: boolean;
  attendance_messages_sent: boolean;
  transcript_id?: string | null;
  profile_id?: string | null;       // which persona to use
  camera_off: boolean;              // bot joins with camera off (default true)
  mic_off: boolean;                 // bot joins with mic off (default true, until voice feature ready)
  auth_mode: AuthMode;              // anonymous (default), signed_in, registration
  breakout_room_mode?: BreakoutRoomMode | null;
  breakout_room_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMeetingInput {
  title: string;
  platform?: PlatformType | string;
  join_url: string;
  start_time: string;
  end_time?: string;
  instruction?: string;
  join_delay_minutes?: number;
  attendance_method?: AttendanceMethod;
  attendance_form_url?: string;
  zoom_user_email?: string;
  profile_id?: string;
  camera_off?: boolean;
  mic_off?: boolean;
  auth_mode?: AuthMode;
  breakout_room_mode?: BreakoutRoomMode;
  breakout_room_id?: string;
}

export interface UpdateMeetingInput {
  title?: string;
  platform?: PlatformType | string;
  join_url?: string;
  start_time?: string;
  end_time?: string;
  status?: MeetingStatus;
  bot_id?: string | null;
  instruction?: string;
  join_delay_minutes?: number;
  attendance_method?: AttendanceMethod;
  attendance_form_url?: string;
  zoom_user_email?: string;
  prixie_attended?: boolean;
  attendance_messages_sent?: boolean;
  transcript_id?: string | null;
  profile_id?: string | null;
  camera_off?: boolean;
  mic_off?: boolean;
  auth_mode?: AuthMode;
}

export interface CaptureRequest {
  id: string;
  meeting_id: string;
  title: string;
  type: CaptureType;
  keywords?: string[];
  notes?: string | null;
  question?: string | null;
  answer?: string | null;
  captured_content?: string | null;
  captured_chat_links?: string[] | null;
  captured_screenshot_url?: string | null;
  screenshot_enabled: boolean;
  check_chat: boolean;
  status: CaptureStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCaptureRequestInput {
  meeting_id?: string;
  title: string;
  type: CaptureType;
  keywords?: string[];
  notes?: string;
  question?: string;
  screenshot_enabled?: boolean;
  check_chat?: boolean;
}

export interface UpdateCaptureRequestInput {
  title?: string;
  type?: CaptureType;
  keywords?: string[];
  notes?: string;
  question?: string;
  answer?: string;
  captured_content?: string;
  captured_chat_links?: string[];
  captured_screenshot_url?: string;
  screenshot_enabled?: boolean;
  check_chat?: boolean;
  status?: CaptureStatus;
}

export interface Transcript {
  id: string;
  meeting_id: string;
  full_transcript: string;
  summary?: string | null;
  action_items?: string[] | null;
  captured_items?: Record<string, unknown> | null;
  created_at?: string;
}

export interface AttendanceMessage {
  id: string;
  meeting_id: string;
  message_text: string;
  trigger: MessageTrigger;
  sent_at?: string | null;
  sent_status: MessageSentStatus;
  created_at?: string;
}

// Recall.ai API & Webhook Types
export interface RecallParticipant {
  id?: number | string;
  name: string;
  is_host?: boolean;
  platform?: string;
  email?: string;
}

export interface RecallWord {
  text: string;
  start_timestamp?: number;
  end_timestamp?: number;
  confidence?: number;
}

export interface RecallTranscriptSegment {
  participant: RecallParticipant;
  words: RecallWord[];
}

export interface RecallChatMessageEventData {
  participant: RecallParticipant;
  data: {
    text: string;
    to?: string;
  };
}

export interface RecallRealtimeWebhookPayload {
  event: 'transcript.data' | 'transcript.partial_data' | 'participant_events.chat_message' | string;
  data: {
    bot_id?: string;
    data?: RecallTranscriptSegment | RecallChatMessageEventData | any;
    transcript_data?: RecallTranscriptSegment;
  };
}

export type BotStatusEvent = 
  | 'bot.joining_call'
  | 'bot.in_waiting_room'
  | 'bot.in_call'
  | 'bot.call_ended'
  | 'bot.recording_done'
  | 'bot.fatal';

export interface RecallStatusWebhookPayload {
  event: BotStatusEvent | string;
  data: {
    bot_id: string;
    status?: {
      code: string;
      sub_code?: string;
      message?: string;
    };
    recording?: any;
    status_changes?: Array<{ code: string; created_at: string }>;
  };
}

export interface RecallCreateBotInput {
  bot_name?: string;
  meeting_url: string;
  join_at?: string;
  recording_config?: {
    transcript?: {
      provider?: {
        kind: string;
      };
    };
    diarization?: {
      use_separate_streams_when_available: boolean;
    };
    realtime_endpoints?: Array<{
      type?: string;
      url: string;
      events: string[];
    }>;
  };
  chat_config?: {
    messages_on_join?: Array<{ text: string; trigger: string }>;
  };
  breakout_room?: {
    mode: BreakoutRoomMode;
    room_id?: string;
  };
  zoom?: {
    user_email?: string;
  };
  meeting_platform?: string;
}
