-- schema for prixie (personal meeting proxy agent)
-- database: supabase (postgresql)
-- run this in the supabase sql editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 0. profiles (personas - sandboxed identity per context)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT,
    context TEXT,
    shared_memory BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.profiles (name, display_name, context, is_default)
VALUES ('default', 'prixie', 'default prixie persona', TRUE)
ON CONFLICT (name) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1. meetings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN (
        'zoom', 'google_meet', 'teams', 'slack',
        'webex', 'discord', 'bluejeans', 'ringcentral',
        'twitch', 'custom'
    )),
    join_url TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'bot_joining', 'bot_in_meeting',
        'completed', 'failed'
    )),
    bot_id TEXT,
    instruction TEXT,
    join_delay_minutes INTEGER DEFAULT 2,
    attendance_method TEXT DEFAULT 'none' CHECK (attendance_method IN (
        'chat_message', 'google_form', 'custom', 'none'
    )),
    attendance_form_url TEXT,
    zoom_user_email TEXT,
    prixie_attended BOOLEAN DEFAULT FALSE,
    attendance_messages_sent BOOLEAN DEFAULT FALSE,
    transcript_id UUID,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    camera_off BOOLEAN DEFAULT TRUE,
    mic_off BOOLEAN DEFAULT TRUE,
    auth_mode TEXT DEFAULT 'anonymous' CHECK (auth_mode IN (
        'anonymous', 'signed_in', 'registration'
    )),
    breakout_room_mode TEXT CHECK (breakout_room_mode IN (
        'auto_accept_all_invites', 'join_main_room', 'join_specific_room'
    )),
    breakout_room_id TEXT,
    -- source tracking (where did this meeting come from?)
    source TEXT CHECK (source IN (
        'manual', 'google_calendar', 'outlook', 'notion',
        'apple_calendar', 'calendly', 'luma', 'discord', 'slack'
    )) DEFAULT 'manual',
    source_event_id TEXT,
    -- timezone awareness
    source_timezone TEXT,
    -- late join tracking
    joined_late BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. capture_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capture_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('capture', 'ask')),
    keywords TEXT[] DEFAULT '{}',
    notes TEXT,
    question TEXT,
    answer TEXT,
    captured_content TEXT,
    captured_chat_links TEXT[] DEFAULT '{}',
    captured_screenshot_url TEXT,
    screenshot_enabled BOOLEAN DEFAULT FALSE,
    check_chat BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'captured', 'answered', 'not_found', 'meeting_skipped'
    )),
    -- when was this captured?
    captured_at TIMESTAMPTZ,
    -- who said it (for transcript-based captures)
    captured_speaker TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. transcripts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    full_transcript TEXT,
    summary TEXT,
    action_items TEXT[] DEFAULT '{}',
    captured_items JSONB DEFAULT '{}'::jsonb,
    -- which transcription service was used?
    transcription_service TEXT CHECK (transcription_service IN (
        'recall_ai', 'assembly_ai', 'speechmatics'
    )) DEFAULT 'recall_ai',
    -- speaker count for diarization tracking
    speaker_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meetings
    DROP CONSTRAINT IF EXISTS fk_meetings_transcript;
ALTER TABLE public.meetings
    ADD CONSTRAINT fk_meetings_transcript
    FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id)
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- 4. attendance_messages
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    trigger TEXT CHECK (trigger IN ('on_join', 'after_delay', 'scheduled')),
    sent_at TIMESTAMPTZ,
    sent_status TEXT DEFAULT 'pending' CHECK (sent_status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. profile_memory (per-profile context and notes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, key)
);

-- -----------------------------------------------------------------------------
-- 6. global_memory (shared across all profiles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.global_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7. sync_states (calendar sync tokens - incremental sync)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    calendar_id TEXT NOT NULL,
    calendar_source TEXT NOT NULL CHECK (calendar_source IN (
        'google', 'outlook', 'notion', 'apple', 'calendly'
    )),
    sync_token TEXT,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(calendar_id, calendar_source)
);

-- -----------------------------------------------------------------------------
-- 8. calendar_sources (multi-calendar configuration)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL CHECK (source IN (
        'google', 'outlook', 'notion', 'apple', 'calendly', 'luma'
    )),
    label TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    -- for google: { calendar_id }
    -- for outlook: { access_token (encrypted) }
    -- for notion: { database_id, access_token (encrypted) }
    -- for apple: { server_url, username (encrypted) }
    -- for calendly: { user_uri }
    -- for luma: { api_key (encrypted) }
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_error TEXT,
    last_synced_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. link_sources (discovered meeting links from various sources)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.link_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    platform TEXT,
    source TEXT NOT NULL CHECK (source IN (
        'gmail', 'discord', 'slack', 'luma', 'forum', 'manual'
    )),
    source_channel TEXT,
    source_message_id TEXT,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'discovered' CHECK (status IN (
        'discovered', 'matched', 'unmatched', 'expired'
    ))
);

-- -----------------------------------------------------------------------------
-- 10. browserbase_sessions (tracking browserbase fallback sessions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.browserbase_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'created' CHECK (status IN (
        'created', 'joining', 'joined', 'in_meeting', 'completed', 'failed'
    )),
    recording_id TEXT,
    transcript_id TEXT,
    screenshot_urls TEXT[] DEFAULT '{}',
    join_attempts INTEGER DEFAULT 0,
    joined_late BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON public.meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_bot_id ON public.meetings(bot_id);
CREATE INDEX IF NOT EXISTS idx_meetings_profile ON public.meetings(profile_id);
CREATE INDEX IF NOT EXISTS idx_meetings_platform ON public.meetings(platform);
CREATE INDEX IF NOT EXISTS idx_meetings_source ON public.meetings(source);
CREATE INDEX IF NOT EXISTS idx_meetings_source_event ON public.meetings(source_event_id);

CREATE INDEX IF NOT EXISTS idx_capture_requests_meeting ON public.capture_requests(meeting_id);
CREATE INDEX IF NOT EXISTS idx_capture_requests_status ON public.capture_requests(status);
CREATE INDEX IF NOT EXISTS idx_capture_requests_keywords ON public.capture_requests USING gin(keywords);

CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON public.transcripts(meeting_id);

CREATE INDEX IF NOT EXISTS idx_attendance_messages_meeting ON public.attendance_messages(meeting_id);

CREATE INDEX IF NOT EXISTS idx_profile_memory_profile ON public.profile_memory(profile_id);

CREATE INDEX IF NOT EXISTS idx_sync_states_calendar ON public.sync_states(calendar_id, calendar_source);
CREATE INDEX IF NOT EXISTS idx_calendar_sources_active ON public.calendar_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_link_sources_status ON public.link_sources(status);
CREATE INDEX IF NOT EXISTS idx_link_sources_url ON public.link_sources(url);
CREATE INDEX IF NOT EXISTS idx_browserbase_sessions_meeting ON public.browserbase_sessions(meeting_id);

-- -----------------------------------------------------------------------------
-- triggers (auto-update updated_at)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_meetings_updated_at ON public.meetings;
CREATE TRIGGER set_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_capture_requests_updated_at ON public.capture_requests;
CREATE TRIGGER set_capture_requests_updated_at BEFORE UPDATE ON public.capture_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_profile_memory_updated_at ON public.profile_memory;
CREATE TRIGGER set_profile_memory_updated_at BEFORE UPDATE ON public.profile_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_sync_states_updated_at ON public.sync_states;
CREATE TRIGGER set_sync_states_updated_at BEFORE UPDATE ON public.sync_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_calendar_sources_updated_at ON public.calendar_sources;
CREATE TRIGGER set_calendar_sources_updated_at BEFORE UPDATE ON public.calendar_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_browserbase_sessions_updated_at ON public.browserbase_sessions;
CREATE TRIGGER set_browserbase_sessions_updated_at BEFORE UPDATE ON public.browserbase_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- row level security (service role has full access, anon has none)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browserbase_sessions ENABLE ROW LEVEL SECURITY;

-- service role gets full access to all tables
CREATE POLICY "service_role_all_profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_capture_requests" ON public.capture_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_transcripts" ON public.transcripts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_attendance_messages" ON public.attendance_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_profile_memory" ON public.profile_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_global_memory" ON public.global_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_sync_states" ON public.sync_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_calendar_sources" ON public.calendar_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_link_sources" ON public.link_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_browserbase_sessions" ON public.browserbase_sessions FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- helpful views
-- -----------------------------------------------------------------------------

-- upcoming meetings with capture request count
CREATE OR REPLACE VIEW public.upcoming_meetings AS
SELECT
    m.id,
    m.title,
    m.platform,
    m.start_time,
    m.status,
    m.profile_id,
    p.display_name AS profile_name,
    COUNT(cr.id) AS capture_request_count,
    COUNT(CASE WHEN cr.status = 'captured' THEN 1 END) AS captured_count
FROM public.meetings m
LEFT JOIN public.profiles p ON m.profile_id = p.id
LEFT JOIN public.capture_requests cr ON cr.meeting_id = m.id
WHERE m.start_time > NOW()
GROUP BY m.id, p.display_name
ORDER BY m.start_time;

-- meeting dashboard (all meetings with stats)
CREATE OR REPLACE VIEW public.meeting_dashboard AS
SELECT
    m.id,
    m.title,
    m.platform,
    m.start_time,
    m.end_time,
    m.status,
    m.prixie_attended,
    m.source,
    m.profile_id,
    p.display_name AS profile_name,
    t.summary AS transcript_summary,
    t.speaker_count,
    COUNT(cr.id) AS total_captures,
    COUNT(CASE WHEN cr.status = 'captured' THEN 1 END) AS captured_count,
    COUNT(CASE WHEN cr.status = 'pending' THEN 1 END) AS pending_captures
FROM public.meetings m
LEFT JOIN public.profiles p ON m.profile_id = p.id
LEFT JOIN public.transcripts t ON t.meeting_id = m.id
LEFT JOIN public.capture_requests cr ON cr.meeting_id = m.id
GROUP BY m.id, p.display_name, t.summary, t.speaker_count
ORDER BY m.start_time DESC;

-- captured items across all meetings
CREATE OR REPLACE VIEW public.all_captures AS
SELECT
    cr.id,
    cr.title,
    cr.type,
    cr.captured_content,
    cr.captured_speaker,
    cr.captured_at,
    cr.captured_chat_links,
    cr.screenshot_enabled,
    cr.captured_screenshot_url,
    cr.status,
    cr.meeting_id,
    m.title AS meeting_title,
    m.platform AS meeting_platform,
    m.start_time AS meeting_start_time
FROM public.capture_requests cr
JOIN public.meetings m ON cr.meeting_id = m.id
WHERE cr.status IN ('captured', 'answered')
ORDER BY cr.captured_at DESC NULLS LAST;
