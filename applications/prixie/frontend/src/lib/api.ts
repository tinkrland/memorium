import type { Meeting, DeployConfig, CaptureRequest, Profile, QuickStats, TranscriptData } from './types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `request failed: ${res.status}`);
  }
  return res.json();
}

// --- meetings ---

export async function listMeetings(): Promise<Meeting[]> {
  return fetchJSON<Meeting[]>('/meetings');
}

export async function getMeeting(id: string): Promise<Meeting> {
  return fetchJSON<Meeting>(`/meetings/${id}`);
}

export async function createMeeting(config: DeployConfig): Promise<Meeting> {
  return fetchJSON<Meeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify({
      title: config.title,
      platform: config.platform,
      join_url: config.join_url,
      start_time: config.start_time,
      end_time: config.end_time,
      join_delay_minutes: config.join_delay_minutes,
      auth_mode: config.auth_mode || 'anonymous',
      camera_off: config.camera_off ?? true,
      mic_off: config.mic_off ?? true,
      zoom_user_email: config.zoom_user_email,
      attendance_method: config.attendance_method,
      attendance_form_url: config.attendance_form_url,
      instruction: config.instruction,
      profile_id: config.profile_id,
      breakout_room_mode: config.breakout_mode,
      breakout_room_id: config.breakout_room_id,
    }),
  });
}

export async function deployPrixie(meetingId: string, config: DeployConfig): Promise<{ bot_id: string; status: string }> {
  return fetchJSON(`/deploy/${meetingId}`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function addCaptureRequest(meetingId: string, req: CaptureRequest): Promise<CaptureRequest> {
  return fetchJSON<CaptureRequest>(`/meetings/${meetingId}/capture`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// --- transcripts ---

export async function getTranscript(meetingId: string): Promise<TranscriptData> {
  return fetchJSON<TranscriptData>(`/transcripts/${meetingId}`);
}

// --- profiles ---

export async function listProfiles(): Promise<Profile[]> {
  return fetchJSON<Profile[]>('/profiles');
}

export async function createProfile(profile: Omit<Profile, 'id'>): Promise<Profile> {
  return fetchJSON<Profile>('/profiles', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

// --- stats ---

export async function getStats(): Promise<QuickStats> {
  return fetchJSON<QuickStats>('/stats');
}

// --- health check ---

export async function checkBackendHealth(): Promise<{ status: string }> {
  try {
    return await fetchJSON<{ status: string }>('/');
  } catch {
    return { status: 'offline' };
  }
}
