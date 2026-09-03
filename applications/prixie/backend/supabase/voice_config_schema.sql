-- proxy voice configuration: fist, cadence, prosody
-- fist = the agent's rhythmic signature (morse code operator concept)
-- a "good fist" = clean, consistent, identifiable. a "bad fist" = erratic.
--
-- run after memorium_schema.sql (which adds tone, voice_id, initiative_level, question_style)

-- fist sub-parameters (the rhythmic identity of the agent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_score FLOAT DEFAULT 0.7
  CHECK (fist_score >= 0 AND fist_score <= 1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_timing_variation FLOAT DEFAULT 0.35
  CHECK (fist_timing_variation >= 0 AND fist_timing_variation <= 1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_rhythm_stability FLOAT DEFAULT 0.72
  CHECK (fist_rhythm_stability >= 0 AND fist_rhythm_stability <= 1);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_pause_pattern TEXT DEFAULT 'deliberate'
  CHECK (fist_pause_pattern IN ('deliberate', 'natural', 'minimal', 'none'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_startup_pattern TEXT DEFAULT 'brief_pause'
  CHECK (fist_startup_pattern IN ('immediate', 'brief_pause', 'deliberate_opening'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fist_turn_entry_pattern TEXT DEFAULT 'beat'
  CHECK (fist_turn_entry_pattern IN ('immediate', 'beat', 'filler', 'deliberate'));

-- cadence (base tempo in words per minute)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cadence_wpm INTEGER DEFAULT 140
  CHECK (cadence_wpm >= 80 AND cadence_wpm <= 220);

-- prosody (melodic pattern — 0 = monotone, 1 = highly expressive)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prosody FLOAT DEFAULT 0.4
  CHECK (prosody >= 0 AND prosody <= 1);

-- language style — word choice & phrasing (independent of rhythm)

-- seriousness (0 = sarcastic, 1 = sincere/serious)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seriousness FLOAT DEFAULT 0.7
  CHECK (seriousness >= 0 AND seriousness <= 1);

-- professionalism (0 = casual/unfiltered, 1 = formal professional)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS professionalism FLOAT DEFAULT 0.5
  CHECK (professionalism >= 0 AND professionalism <= 1);

-- vocabulary (0 = genz slang, 1 = erudite/formal)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vocabulary FLOAT DEFAULT 0.5
  CHECK (vocabulary >= 0 AND vocabulary <= 1);

-- per-meeting voice overrides (stored as JSONB on meetings table)
-- format: {"fist_score": 0.8, "cadence_wpm": 150, "prosody": 0.3, "tone": "formal", "seriousness": 0.8, "professionalism": 0.6, "vocabulary": 0.5,
--          "fist_timing_variation": 0.3, "fist_rhythm_stability": 0.85,
--          "fist_pause_pattern": "natural", "fist_startup_pattern": "immediate",
--          "fist_turn_entry_pattern": "beat"}
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS voice_override JSONB;

-- voice presets reference (stored as a separate table for named presets)
CREATE TABLE IF NOT EXISTS public.voice_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    fist_score FLOAT NOT NULL CHECK (fist_score >= 0 AND fist_score <= 1),
    fist_timing_variation FLOAT CHECK (fist_timing_variation >= 0 AND fist_timing_variation <= 1),
    fist_rhythm_stability FLOAT CHECK (fist_rhythm_stability >= 0 AND fist_rhythm_stability <= 1),
    fist_pause_pattern TEXT CHECK (fist_pause_pattern IN ('deliberate', 'natural', 'minimal', 'none')),
    fist_startup_pattern TEXT CHECK (fist_startup_pattern IN ('immediate', 'brief_pause', 'deliberate_opening')),
    fist_turn_entry_pattern TEXT CHECK (fist_turn_entry_pattern IN ('immediate', 'beat', 'filler', 'deliberate')),
    cadence_wpm INTEGER CHECK (cadence_wpm >= 80 AND cadence_wpm <= 220),
    prosody FLOAT CHECK (prosody >= 0 AND prosody <= 1),
    seriousness FLOAT CHECK (seriousness >= 0 AND seriousness <= 1),
    professionalism FLOAT CHECK (professionalism >= 0 AND professionalism <= 1),
    vocabulary FLOAT CHECK (vocabulary >= 0 AND vocabulary <= 1),
    tone TEXT DEFAULT 'neutral',
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- insert built-in presets
INSERT INTO public.voice_presets (name, description, fist_score, fist_timing_variation, fist_rhythm_stability, fist_pause_pattern, fist_startup_pattern, fist_turn_entry_pattern, cadence_wpm, prosody, tone, seriousness, professionalism, vocabulary, is_builtin)
VALUES
    ('default', 'general purpose — clean, neutral', 0.7, 0.35, 0.72, 'deliberate', 'brief_pause', 'beat', 140, 0.4, 'neutral', 0.7, 0.5, 0.5, TRUE),
    ('warm', 'community and social contexts', 0.65, 0.4, 0.68, 'natural', 'brief_pause', 'filler', 130, 0.6, 'warm', 0.7, 0.4, 0.45, TRUE),
    ('professional', 'client and enterprise meetings', 0.85, 0.25, 0.82, 'deliberate', 'brief_pause', 'beat', 150, 0.2, 'formal', 0.9, 0.9, 0.85, TRUE),
    ('casual', 'internal team and hackathon', 0.55, 0.45, 0.6, 'natural', 'immediate', 'filler', 160, 0.7, 'casual', 0.6, 0.25, 0.3, TRUE),
    ('curious', 'learning and discovery', 0.6, 0.38, 0.65, 'deliberate', 'brief_pause', 'beat', 135, 0.5, 'curious', 0.75, 0.5, 0.55, TRUE),
    ('assertive', 'negotiation and sales', 0.8, 0.28, 0.78, 'deliberate', 'brief_pause', 'beat', 160, 0.3, 'assertive', 0.85, 0.75, 0.6, TRUE),
    ('steady', 'technical and precise — highest fist score', 0.95, 0.15, 0.92, 'deliberate', 'deliberate_opening', 'deliberate', 145, 0.15, 'neutral', 0.9, 0.6, 0.7, TRUE),
    ('erratic', 'deliberately unpredictable — lowest fist score', 0.2, 0.7, 0.25, 'natural', 'immediate', 'immediate', 155, 0.8, 'casual', 0.35, 0.2, 0.25, TRUE)
ON CONFLICT (name) DO NOTHING;
