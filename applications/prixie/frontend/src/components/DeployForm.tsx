import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  Platform,
  AttendanceMethod,
  AuthMode,
  BreakoutMode,
  CaptureRequest,
  DeployConfig,
  Profile,
  VoiceConfig,
  VoiceOverride,
  FistPausePattern,
  FistStartupPattern,
  FistTurnEntryPattern,
  ToneType,
  LocalizationConfig,
  UnitSystem,
  WeekStart,
  Weekday,
  AudienceScope,
} from '../lib/types';
import { createMeeting, deployPrixie, listProfiles } from '../lib/api';
import { CaptureRequestForm } from './CaptureRequestForm';

// built-in voice presets (mirrors backend voice_config_schema.sql)
const BUILTIN_PRESETS: Record<string, Partial<VoiceConfig> & { name: string; description: string }> = {
  default:     { name: 'default',     description: 'general purpose — clean, neutral',         fist_score: 0.7,  fist_timing_variation: 0.35, fist_rhythm_stability: 0.72, fist_pause_pattern: 'deliberate',   fist_startup_pattern: 'brief_pause',       fist_turn_entry_pattern: 'beat',       cadence_wpm: 140, prosody: 0.4,  tone: 'neutral', seriousness: 0.7, professionalism: 0.5, vocabulary: 0.5 },
  warm:        { name: 'warm',        description: 'community and social contexts',            fist_score: 0.65, fist_timing_variation: 0.4,  fist_rhythm_stability: 0.68, fist_pause_pattern: 'natural',      fist_startup_pattern: 'brief_pause',       fist_turn_entry_pattern: 'filler',      cadence_wpm: 130, prosody: 0.6,  tone: 'warm', seriousness: 0.7, professionalism: 0.4, vocabulary: 0.45 },
  professional:{ name: 'professional', description: 'client and enterprise meetings',         fist_score: 0.85, fist_timing_variation: 0.25, fist_rhythm_stability: 0.82, fist_pause_pattern: 'deliberate',   fist_startup_pattern: 'brief_pause',       fist_turn_entry_pattern: 'beat',       cadence_wpm: 150, prosody: 0.2,  tone: 'formal', seriousness: 0.9, professionalism: 0.9, vocabulary: 0.85 },
  casual:      { name: 'casual',      description: 'internal team and hackathon',              fist_score: 0.55, fist_timing_variation: 0.45, fist_rhythm_stability: 0.6,  fist_pause_pattern: 'natural',      fist_startup_pattern: 'immediate',         fist_turn_entry_pattern: 'filler',      cadence_wpm: 160, prosody: 0.7,  tone: 'casual', seriousness: 0.6, professionalism: 0.25, vocabulary: 0.3 },
  curious:     { name: 'curious',     description: 'learning and discovery',                   fist_score: 0.6,  fist_timing_variation: 0.38, fist_rhythm_stability: 0.65, fist_pause_pattern: 'deliberate',   fist_startup_pattern: 'brief_pause',       fist_turn_entry_pattern: 'beat',       cadence_wpm: 135, prosody: 0.5,  tone: 'curious', seriousness: 0.75, professionalism: 0.5, vocabulary: 0.55 },
  assertive:   { name: 'assertive',   description: 'negotiation and sales',                    fist_score: 0.8,  fist_timing_variation: 0.28, fist_rhythm_stability: 0.78, fist_pause_pattern: 'deliberate',   fist_startup_pattern: 'brief_pause',       fist_turn_entry_pattern: 'beat',       cadence_wpm: 160, prosody: 0.3,  tone: 'assertive', seriousness: 0.85, professionalism: 0.75, vocabulary: 0.6 },
  steady:      { name: 'steady',      description: 'technical and precise — highest fist',    fist_score: 0.95, fist_timing_variation: 0.15, fist_rhythm_stability: 0.92, fist_pause_pattern: 'deliberate',   fist_startup_pattern: 'deliberate_opening', fist_turn_entry_pattern: 'deliberate', cadence_wpm: 145, prosody: 0.15, tone: 'neutral', seriousness: 0.9, professionalism: 0.6, vocabulary: 0.7 },
  erratic:     { name: 'erratic',     description: 'deliberately unpredictable — lowest fist', fist_score: 0.2, fist_timing_variation: 0.7,  fist_rhythm_stability: 0.25, fist_pause_pattern: 'natural',      fist_startup_pattern: 'immediate',         fist_turn_entry_pattern: 'immediate',   cadence_wpm: 155, prosody: 0.8,  tone: 'casual', seriousness: 0.35, professionalism: 0.2, vocabulary: 0.25 },
};

const TONES: ToneType[] = ['neutral', 'warm', 'formal', 'casual', 'curious', 'assertive'];

function fistLabel(score: number): string {
  if (score >= 0.85) return 'pristine — highly identifiable, consistent';
  if (score >= 0.7)  return 'clean — consistent, recognizable';
  if (score >= 0.5)  return 'moderate — some variation, loosely identifiable';
  if (score >= 0.3)  return 'rough — inconsistent, hard to identify';
  return 'erratic — unpredictable, unidentifiable';
}

export function DeployForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // profiles
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => {});
  }, []);

  // 1. Meeting details
  const [joinUrl, setJoinUrl] = useState('');
  const [platform, setPlatform] = useState<Platform>('zoom');
  const [title, setTitle] = useState('');
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const defaultStartTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState('');

  // 2. Join behavior
  const [joinDelay, setJoinDelay] = useState<number>(2);
  const [authMode, setAuthMode] = useState<AuthMode>('anonymous');
  const [cameraOff, setCameraOff] = useState(true);
  const [micOff, setMicOff] = useState(true);
  const [useDifferentEmail, setUseDifferentEmail] = useState(false);
  const [zoomUserEmail, setZoomUserEmail] = useState('');

  // 3. Attendance
  const [attendanceMethod, setAttendanceMethod] = useState<AttendanceMethod>('chat_message');
  const [attendanceMessage, setAttendanceMessage] = useState('present!');
  const [attendanceFormUrl, setAttendanceFormUrl] = useState('');

  // 4. What to capture
  const [captureRequests, setCaptureRequests] = useState<CaptureRequest[]>([
    {
      title: 'access codes & credits',
      type: 'capture',
      keywords: ['access code', 'claim code', 'credits', 'discount'],
      notes: 'listen for codes spoken or pasted in chat',
      check_chat: true,
      screenshot: true
    }
  ]);
  const [showAddRequestForm, setShowAddRequestForm] = useState(false);

  // 5. Breakout rooms (Zoom only)
  const [breakoutMode, setBreakoutMode] = useState<BreakoutMode>('auto_accept_all_invites');
  const [breakoutRoomId, setBreakoutRoomId] = useState('');

  // 6. Instruction
  const [instruction, setInstruction] = useState('');

  // 7. Voice & behavior (proxy voice config)
  const [voicePreset, setVoicePreset] = useState<string>('default');
  const [fistScore, setFistScore] = useState(0.7);
  const [fistTimingVariation, setFistTimingVariation] = useState(0.35);
  const [fistRhythmStability, setFistRhythmStability] = useState(0.72);
  const [fistPausePattern, setFistPausePattern] = useState<FistPausePattern>('deliberate');
  const [fistStartupPattern, setFistStartupPattern] = useState<FistStartupPattern>('brief_pause');
  const [fistTurnEntryPattern, setFistTurnEntryPattern] = useState<FistTurnEntryPattern>('beat');
  const [cadenceWpm, setCadenceWpm] = useState(140);
  const [prosody, setProsody] = useState(0.4);
  const [tone, setTone] = useState<string>('neutral');
  const [seriousness, setSeriousness] = useState(0.7);
  const [professionalism, setProfessionalism] = useState(0.5);
  const [vocabulary, setVocabulary] = useState(0.5);
  const [showAdvancedFist, setShowAdvancedFist] = useState(false);
  // localization
  const [localizationEnabled, setLocalizationEnabled] = useState(false);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [weekStart, setWeekStart] = useState<WeekStart>('monday');
  const [nonWorkDays, setNonWorkDays] = useState<Weekday[]>(['sat', 'sun']);
  const [audience, setAudience] = useState<AudienceScope>('local');
  const [timezoneAwareness, setTimezoneAwareness] = useState(true);
  const [translitLangs, setTranslitLangs] = useState<{ language: string; priority: number; usage: number }[]>([]);

  // behavior
  const [initiative, setInitiative] = useState<'passive' | 'moderate' | 'proactive'>('moderate');
  const [questionStyle, setQuestionStyle] = useState<'direct' | 'indirect' | 'socratic'>('indirect');
  const [maxQuestions, setMaxQuestions] = useState(3);
  const [clarificationDepth, setClarificationDepth] = useState(2);

  const applyPreset = (presetName: string) => {
    const p = BUILTIN_PRESETS[presetName];
    if (!p) return;
    setVoicePreset(presetName);
    if (p.fist_score !== undefined) setFistScore(p.fist_score);
    if (p.fist_timing_variation !== undefined) setFistTimingVariation(p.fist_timing_variation);
    if (p.fist_rhythm_stability !== undefined) setFistRhythmStability(p.fist_rhythm_stability);
    if (p.fist_pause_pattern) setFistPausePattern(p.fist_pause_pattern as FistPausePattern);
    if (p.fist_startup_pattern) setFistStartupPattern(p.fist_startup_pattern as FistStartupPattern);
    if (p.fist_turn_entry_pattern) setFistTurnEntryPattern(p.fist_turn_entry_pattern as FistTurnEntryPattern);
    if (p.cadence_wpm !== undefined) setCadenceWpm(p.cadence_wpm);
    if (p.prosody !== undefined) setProsody(p.prosody);
    if (p.tone) setTone(p.tone);
    if (p.seriousness !== undefined) setSeriousness(p.seriousness);
    if (p.professionalism !== undefined) setProfessionalism(p.professionalism);
    if (p.vocabulary !== undefined) setVocabulary(p.vocabulary);
  };

  // localization helpers
  const toggleNonWorkDay = (day: Weekday) => {
    setNonWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const addTranslitLang = (lang: string) => {
    if (!lang || translitLangs.some(l => l.language === lang)) return;
    setTranslitLangs(prev => [...prev, { language: lang, priority: prev.length + 1, usage: 0.5 }]);
  };

  const removeTranslitLang = (lang: string) => {
    setTranslitLangs(prev => prev.filter(l => l.language !== lang).map((l, i) => ({ ...l, priority: i + 1 })));
  };

  const moveTranslitLang = (lang: string, dir: -1 | 1) => {
    setTranslitLangs(prev => {
      const idx = prev.findIndex(l => l.language === lang);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((l, i) => ({ ...l, priority: i + 1 }));
    });
  };

  const setTranslitUsage = (lang: string, usage: number) => {
    setTranslitLangs(prev => prev.map(l => l.language === lang ? { ...l, usage } : l));
  };

  const buildLocalization = (): LocalizationConfig | undefined => {
    if (!localizationEnabled) return undefined;
    return {
      unit_system: unitSystem,
      week_start: weekStart,
      non_work_days: nonWorkDays,
      audience,
      timezone_awareness: timezoneAwareness,
      transliteration: translitLangs,
    };
  };

  const buildVoiceOverride = (): VoiceOverride | undefined => {
    // only include if user changed from defaults
    const defaults = BUILTIN_PRESETS.default;
    const override: VoiceOverride = {};
    if (fistScore !== defaults.fist_score) override.fist_score = fistScore;
    if (fistTimingVariation !== defaults.fist_timing_variation) override.fist_timing_variation = fistTimingVariation;
    if (fistRhythmStability !== defaults.fist_rhythm_stability) override.fist_rhythm_stability = fistRhythmStability;
    if (fistPausePattern !== defaults.fist_pause_pattern) override.fist_pause_pattern = fistPausePattern;
    if (fistStartupPattern !== defaults.fist_startup_pattern) override.fist_startup_pattern = fistStartupPattern;
    if (fistTurnEntryPattern !== defaults.fist_turn_entry_pattern) override.fist_turn_entry_pattern = fistTurnEntryPattern;
    if (cadenceWpm !== defaults.cadence_wpm) override.cadence_wpm = cadenceWpm;
    if (prosody !== defaults.prosody) override.prosody = prosody;
    if (tone !== defaults.tone) override.tone = tone;
    if (seriousness !== defaults.seriousness) override.seriousness = seriousness;
    if (professionalism !== defaults.professionalism) override.professionalism = professionalism;
    if (vocabulary !== defaults.vocabulary) override.vocabulary = vocabulary;
    return Object.keys(override).length > 0 ? override : undefined;
  };

  const handleAddCaptureRequest = (req: CaptureRequest) => {
    setCaptureRequests([...captureRequests, req]);
    setShowAddRequestForm(false);
  };

  const handleRemoveCaptureRequest = (index: number) => {
    setCaptureRequests(captureRequests.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinUrl.trim() || !title.trim()) {
      setError('please provide both meeting url and title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const config: DeployConfig = {
        join_url: joinUrl.trim(),
        platform,
        title: title.trim(),
        start_time: new Date(startTime).toISOString(),
        end_time: endTime ? new Date(endTime).toISOString() : undefined,
        join_delay_minutes: Number(joinDelay),
        auth_mode: authMode,
        camera_off: cameraOff,
        mic_off: micOff,
        use_different_email: useDifferentEmail,
        zoom_user_email: useDifferentEmail ? zoomUserEmail.trim() : undefined,
        attendance_method: attendanceMethod,
        attendance_message: attendanceMethod === 'chat_message' ? attendanceMessage.trim() : undefined,
        attendance_form_url: attendanceMethod === 'google_form' ? attendanceFormUrl.trim() : undefined,
        capture_requests: captureRequests,
        breakout_mode: platform === 'zoom' ? breakoutMode : undefined,
        breakout_room_id: platform === 'zoom' && breakoutMode === 'join_specific_room' ? breakoutRoomId.trim() : undefined,
        instruction: instruction.trim(),
        profile_id: selectedProfileId || undefined,
        voice_override: buildVoiceOverride(),
        localization: buildLocalization(),
      } as DeployConfig;

      const meeting = await createMeeting(config);
      await deployPrixie(meeting.id, config);
      navigate({ to: '/meeting/$id', params: { id: meeting.id } });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'failed to deploy prixie to meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full border border-primary bg-background p-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary";
  const labelClass = "block text-muted-foreground mb-1";
  const sliderClass = "w-full accent-primary";
  const selectClass = "border border-primary bg-background p-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 font-mono">
      {error && (
        <div className="border border-primary bg-primary/10 p-3 text-xs text-primary">
          [error]: {error}
        </div>
      )}

      {/* 01 meeting details */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">01 // meeting details</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">where is prixie going?</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className={labelClass}>meeting url *</label>
            <input type="url" required placeholder="https://zoom.us/j/... or https://meet.google.com/..." value={joinUrl} onChange={e => setJoinUrl(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>platform *</label>
            <select value={platform} onChange={e => setPlatform(e.target.value as Platform)} className={inputClass}>
              <option value="zoom">zoom</option>
              <option value="google_meet">google meet</option>
              <option value="teams">microsoft teams</option>
              <option value="slack">slack huddle</option>
              <option value="webex">cisco webex</option>
              <option value="discord">discord (browserbase)</option>
              <option value="bluejeans">bluejeans (browserbase)</option>
              <option value="ringcentral">ringcentral (browserbase)</option>
              <option value="custom">custom / other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>meeting title *</label>
            <input type="text" required placeholder="e.g. hackathon rules & credit distribution" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>start time *</label>
            <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>end time (optional)</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass} />
          </div>
        </div>
      </section>

      {/* 02 join behavior */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">02 // join behavior</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">timing & identity</h2>
        </div>
        <div className="space-y-4 text-xs">
          <div>
            <label className={labelClass}>join delay (minutes after start time)</label>
            <input type="number" min={0} max={30} value={joinDelay} onChange={e => setJoinDelay(Number(e.target.value))} className="w-32 border border-primary bg-background p-2 text-foreground" />
            <span className="ml-2 text-[11px] text-muted-foreground">(default 2 mins — lets organizers open the room first)</span>
          </div>

          <div>
            <label className={labelClass}>auth mode</label>
            <select value={authMode} onChange={e => setAuthMode(e.target.value as AuthMode)} className={inputClass}>
              <option value="anonymous">anonymous (join as guest, no login)</option>
              <option value="signed_in">signed in (use account credentials)</option>
              <option value="registration">registration (pre-registered with email/token)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-primary/20 pt-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
              <input type="checkbox" checked={cameraOff} onChange={e => setCameraOff(e.target.checked)} className="accent-primary" />
              camera off
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
              <input type="checkbox" checked={micOff} onChange={e => setMicOff(e.target.checked)} className="accent-primary" />
              mic off
            </label>
          </div>

          <div className="border-t border-primary/20 pt-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
              <input type="checkbox" checked={useDifferentEmail} onChange={e => setUseDifferentEmail(e.target.checked)} className="accent-primary" />
              join with a different email (zoom webinars / registration)
            </label>
            {useDifferentEmail && (
              <div className="mt-2 pl-6">
                <input type="email" placeholder="proxy-guest@prixie.internal" value={zoomUserEmail} onChange={e => setZoomUserEmail(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>persona / profile</label>
            <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className={inputClass}>
              <option value="">default (no specific persona)</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.display_name} ({p.name})</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">selecting a persona loads its voice config as defaults (section 07)</span>
          </div>
        </div>
      </section>

      {/* 03 attendance */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">03 // attendance</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">check-in method</h2>
        </div>
        <div className="space-y-4 text-xs">
          <div>
            <label className={labelClass}>attendance method</label>
            <select value={attendanceMethod} onChange={e => setAttendanceMethod(e.target.value as AttendanceMethod)} className={inputClass}>
              <option value="chat_message">chat message (send a message in meeting chat)</option>
              <option value="google_form">google form (fill out an attendance form url)</option>
              <option value="custom">custom (e.g. type in a specific code)</option>
              <option value="none">none (just attend, no check-in)</option>
            </select>
          </div>
          {attendanceMethod === 'chat_message' && (
            <div>
              <label className={labelClass}>attendance message</label>
              <input type="text" placeholder="present!" value={attendanceMessage} onChange={e => setAttendanceMessage(e.target.value)} className={inputClass} />
            </div>
          )}
          {attendanceMethod === 'google_form' && (
            <div>
              <label className={labelClass}>google form url</label>
              <input type="url" placeholder="https://forms.gle/..." value={attendanceFormUrl} onChange={e => setAttendanceFormUrl(e.target.value)} className={inputClass} />
            </div>
          )}
        </div>
      </section>

      {/* 04 capture requests */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">04 // capture requests</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">what should prixie grab?</h2>
        </div>
        <div className="space-y-3 text-xs">
          {captureRequests.map((req, i) => (
            <div key={i} className="border border-primary/30 p-3 bg-background">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-primary">{req.type}</span>
                  <p className="font-bold text-foreground">{req.title}</p>
                  {req.notes && <p className="text-muted-foreground mt-1">{req.notes}</p>}
                  {req.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {req.keywords.map((kw, j) => (
                        <span key={j} className="border border-primary/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => handleRemoveCaptureRequest(i)} className="text-primary hover:text-primary/70 ml-2">×</button>
              </div>
            </div>
          ))}
          {showAddRequestForm ? (
            <CaptureRequestForm onAdd={handleAddCaptureRequest} />
          ) : (
            <button type="button" onClick={() => setShowAddRequestForm(true)} className="border border-dashed border-primary w-full p-2 text-muted-foreground hover:bg-primary/5 transition-colors">
              + add capture request
            </button>
          )}
        </div>
      </section>

      {/* 05 breakout rooms (zoom only) */}
      {platform === 'zoom' && (
        <section className="border border-primary bg-card p-5">
          <div className="border-b border-primary pb-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">05 // breakout rooms</span>
            <h2 className="text-base font-bold uppercase tracking-tight text-foreground">breakout behavior (zoom only)</h2>
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <label className={labelClass}>breakout mode</label>
              <select value={breakoutMode} onChange={e => setBreakoutMode(e.target.value as BreakoutMode)} className={inputClass}>
                <option value="auto_accept_all_invites">auto-accept all breakout invites</option>
                <option value="join_main_room">stay in main room</option>
                <option value="join_specific_room">join a specific breakout room</option>
              </select>
            </div>
            {breakoutMode === 'join_specific_room' && (
              <div>
                <label className={labelClass}>breakout room id</label>
                <input type="text" placeholder="room id" value={breakoutRoomId} onChange={e => setBreakoutRoomId(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* 06 instruction */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">06 // instruction</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">what does prixie need to know?</h2>
        </div>
        <textarea
          placeholder="e.g. grab any access codes shared during the call for claiming hackathon credits. also capture any google form links for attendance or project submission."
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          rows={4}
          className={inputClass}
        />
      </section>

      {/* 07 proxy voice & behavior */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">07 // proxy voice & behavior</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">how does prixie sound?</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            fist = the agent's rhythmic signature (from morse code). a good fist is clean and identifiable. a bad fist is erratic. these settings shape how prixie sounds when speaking in meetings. the language style sliders (sarcastic vs serious, professionalism, vocabulary) shape how she words things — genz in one meeting, boardroom in the next.
          </p>
        </div>
        <div className="space-y-5 text-xs">
          {/* voice preset selector */}
          <div>
            <label className={labelClass}>voice preset</label>
            <select value={voicePreset} onChange={e => applyPreset(e.target.value)} className={inputClass}>
              {Object.entries(BUILTIN_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.name} — {p.description}</option>
              ))}
            </select>
          </div>

          {/* fist slider */}
          <div className="border border-primary/20 p-3 bg-background">
            <label className={labelClass}>fist — rhythmic signature</label>
            <input type="range" min={0} max={1} step={0.01} value={fistScore} onChange={e => setFistScore(Number(e.target.value))} className={sliderClass} />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">erratic (bad fist)</span>
              <span className="text-[11px] font-bold text-foreground">{fistScore.toFixed(2)}</span>
              <span className="text-[10px] text-muted-foreground">pristine (good fist)</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{fistLabel(fistScore)}</p>
          </div>

          {/* cadence + prosody */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>cadence — {cadenceWpm} wpm</label>
              <input type="range" min={80} max={220} step={1} value={cadenceWpm} onChange={e => setCadenceWpm(Number(e.target.value))} className={sliderClass} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">slow (80)</span>
                <span className="text-[10px] text-muted-foreground">fast (220)</span>
              </div>
            </div>
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>prosody — {prosody.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.01} value={prosody} onChange={e => setProsody(Number(e.target.value))} className={sliderClass} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">monotone</span>
                <span className="text-[10px] text-muted-foreground">expressive</span>
              </div>
            </div>
          </div>

          {/* language style — sarcasm, professionalism, vocabulary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>seriousness — {seriousness.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.01} value={seriousness} onChange={e => setSeriousness(Number(e.target.value))} className={sliderClass} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">sarcastic</span>
                <span className="text-[10px] text-muted-foreground">sincere</span>
              </div>
            </div>
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>professionalism — {professionalism.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.01} value={professionalism} onChange={e => setProfessionalism(Number(e.target.value))} className={sliderClass} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">casual</span>
                <span className="text-[10px] text-muted-foreground">formal</span>
              </div>
            </div>
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>vocabulary — {vocabulary.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.01} value={vocabulary} onChange={e => setVocabulary(Number(e.target.value))} className={sliderClass} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">genz slang</span>
                <span className="text-[10px] text-muted-foreground">erudite</span>
              </div>
            </div>
          </div>

          {/* tone */}
          <div>
            <label className={labelClass}>tone — emotional register</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`border px-3 py-1 text-[11px] transition-colors ${
                    tone === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-primary/30 text-muted-foreground hover:bg-primary/5'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* advanced fist controls */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvancedFist(!showAdvancedFist)}
              className="text-[11px] text-primary hover:text-primary/70"
            >
              {showAdvancedFist ? '▼' : '▶'} advanced fist controls
            </button>
          </div>

          {showAdvancedFist && (
            <div className="border border-primary/20 p-3 bg-background space-y-4">
              <div>
                <label className={labelClass}>timing variation — {fistTimingVariation.toFixed(2)}</label>
                <input type="range" min={0} max={1} step={0.01} value={fistTimingVariation} onChange={e => setFistTimingVariation(Number(e.target.value))} className={sliderClass} />
                <span className="text-[10px] text-muted-foreground">low = metronomic, high = natural human variation</span>
              </div>
              <div>
                <label className={labelClass}>rhythm stability — {fistRhythmStability.toFixed(2)}</label>
                <input type="range" min={0} max={1} step={0.01} value={fistRhythmStability} onChange={e => setFistRhythmStability(Number(e.target.value))} className={sliderClass} />
                <span className="text-[10px] text-muted-foreground">low = drifts over time, high = rock-steady</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>pause pattern</label>
                  <select value={fistPausePattern} onChange={e => setFistPausePattern(e.target.value as FistPausePattern)} className={selectClass}>
                    <option value="deliberate">deliberate</option>
                    <option value="natural">natural</option>
                    <option value="minimal">minimal</option>
                    <option value="none">none</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>startup pattern</label>
                  <select value={fistStartupPattern} onChange={e => setFistStartupPattern(e.target.value as FistStartupPattern)} className={selectClass}>
                    <option value="immediate">immediate</option>
                    <option value="brief_pause">brief pause</option>
                    <option value="deliberate_opening">deliberate opening</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>turn entry pattern</label>
                  <select value={fistTurnEntryPattern} onChange={e => setFistTurnEntryPattern(e.target.value as FistTurnEntryPattern)} className={selectClass}>
                    <option value="immediate">immediate</option>
                    <option value="beat">beat</option>
                    <option value="filler">filler</option>
                    <option value="deliberate">deliberate</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* preview placeholder */}
          <div className="border border-dashed border-primary/30 p-3 text-center text-[11px] text-muted-foreground">
            ▶ preview voice (requires TTS integration — not yet wired)
          </div>

          {/* behavior controls */}
          <div className="border-t border-primary/20 pt-4 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">behavior</span>

            <div>
              <label className={labelClass}>initiative</label>
              <div className="flex gap-2">
                {(['passive', 'moderate', 'proactive'] as const).map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInitiative(i)}
                    className={`border px-3 py-1 text-[11px] transition-colors ${
                      initiative === i
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-primary/30 text-muted-foreground hover:bg-primary/5'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>question style</label>
              <div className="flex gap-2">
                {(['direct', 'indirect', 'socratic'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuestionStyle(s)}
                    className={`border px-3 py-1 text-[11px] transition-colors ${
                      questionStyle === s
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-primary/30 text-muted-foreground hover:bg-primary/5'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>max questions per meeting</label>
                <input type="number" min={0} max={20} value={maxQuestions} onChange={e => setMaxQuestions(Number(e.target.value))} className="w-24 border border-primary bg-background p-2 text-foreground" />
              </div>
              <div>
                <label className={labelClass}>clarification depth</label>
                <input type="number" min={0} max={5} value={clarificationDepth} onChange={e => setClarificationDepth(Number(e.target.value))} className="w-24 border border-primary bg-background p-2 text-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 08 localization */}
      <section className="border border-primary/30 p-4 md:p-6 bg-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">08 // localization</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={localizationEnabled} onChange={e => setLocalizationEnabled(e.target.checked)} className="accent-primary w-4 h-4" />
            <span className="text-xs text-muted-foreground">enable localization</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          optional. when enabled, prixie adapts to locale — units, week conventions, cultural references, participants' local time, and language mix. same meeting, different country, different manners. off by default.
        </p>

        {localizationEnabled && (
          <div className="space-y-4">
            {/* unit system */}
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>unit system</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['metric', 'imperial', 'us_customary'] as UnitSystem[]).map(u => (
                  <button key={u} type="button" onClick={() => setUnitSystem(u)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wide border ${unitSystem === u ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-foreground hover:border-primary'}`}>
                    {u.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">km vs miles, kg vs lbs, celsius vs fahrenheit.</p>
            </div>

            {/* week conventions */}
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>week conventions</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['monday', 'sunday'] as WeekStart[]).map(w => (
                  <button key={w} type="button" onClick={() => setWeekStart(w)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wide border ${weekStart === w ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-foreground hover:border-primary'}`}>
                    {w} start
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 mb-1">non-work days (tick friday for countries where the weekend is fri–sat):</p>
              <div className="flex flex-wrap gap-2">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as Weekday[]).map(d => (
                  <label key={d} className="flex items-center gap-1 text-xs cursor-pointer border border-primary/30 px-2 py-1">
                    <input type="checkbox" checked={nonWorkDays.includes(d)} onChange={() => toggleNonWorkDay(d)} className="accent-primary" />
                    {d}
                  </label>
                ))}
              </div>
            </div>

            {/* audience */}
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>audience</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['local', 'mixed', 'international'] as AudienceScope[]).map(a => (
                  <button key={a} type="button" onClick={() => setAudience(a)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wide border ${audience === a ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-foreground hover:border-primary'}`}>
                    {a}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                local = shared context, name the festival. international = generic references ("a national holiday") — someone abroad from germany won't know which festival it was.
              </p>
            </div>

            {/* timezone / locational awareness */}
            <div className="border border-primary/20 p-3 bg-background">
              <label className="flex items-center justify-between">
                <span className={labelClass}>timezone & locational awareness</span>
                <input type="checkbox" checked={timezoneAwareness} onChange={e => setTimezoneAwareness(e.target.checked)} className="accent-primary w-4 h-4" />
              </label>
              <p className="text-[10px] text-muted-foreground mt-1">
                when on, prixie tracks participants' local time and norms. if it's 7pm thursday for them — in a country where friday isn't a work day — she won't ask for a deliverable "in the next few hours", even if it's monday 8am for you.
              </p>
            </div>

            {/* transliteration / language mix */}
            <div className="border border-primary/20 p-3 bg-background">
              <label className={labelClass}>transliteration — language mix</label>
              <p className="text-[10px] text-muted-foreground mt-1 mb-2">
                select languages, then order them by priority (who wins conflicts) and slide how much each carries. hindi + english = hinglish.
              </p>
              <select onChange={e => { addTranslitLang(e.target.value); e.target.value = ''; }}
                className="w-full border border-primary bg-background p-2 text-sm text-foreground mb-2"
                defaultValue="">
                <option value="" disabled>+ add a language</option>
                {['english', 'hindi', 'spanish', 'french', 'german', 'portuguese', 'mandarin', 'arabic', 'russian', 'japanese', 'korean', 'turkish', 'bengali', 'tamil', 'telugu', 'urdu', 'marathi', 'gujarati', 'punjabi', 'dutch', 'italian', 'hebrew', 'indonesian', 'swahili'].filter(l => !translitLangs.some(t => t.language === l)).map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {translitLangs.length === 0 && (
                <p className="text-[10px] text-muted-foreground">no languages selected — prixie mirrors the caller's language.</p>
              )}
              {translitLangs.map((l, i) => (
                <div key={l.language} className="flex items-center gap-2 border border-primary/20 px-2 py-1.5 mb-1.5">
                  <span className="text-xs font-bold text-primary w-4">#{l.priority}</span>
                  <span className="text-sm text-foreground flex-1">{l.language}</span>
                  <button type="button" onClick={() => moveTranslitLang(l.language, -1)} disabled={i === 0} className="px-1.5 border border-primary/30 text-xs disabled:opacity-30">&uarr;</button>
                  <button type="button" onClick={() => moveTranslitLang(l.language, 1)} disabled={i === translitLangs.length - 1} className="px-1.5 border border-primary/30 text-xs disabled:opacity-30">&darr;</button>
                  <input type="range" min={0} max={1} step={0.05} value={l.usage} onChange={e => setTranslitUsage(l.language, Number(e.target.value))} className={sliderClass + ' w-24'} />
                  <span className="text-[10px] text-muted-foreground w-8">{l.usage.toFixed(2)}</span>
                  <button type="button" onClick={() => removeTranslitLang(l.language)} className="px-1.5 border border-primary/30 text-xs hover:border-destructive hover:text-destructive">&times;</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full border border-primary bg-primary text-primary-foreground p-3 text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? 'deploying...' : 'deploy prixie'}
      </button>
    </form>
  );
}
