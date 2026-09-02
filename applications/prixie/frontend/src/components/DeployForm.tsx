import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type {
  Platform,
  AttendanceMethod,
  AuthMode,
  BreakoutMode,
  CaptureRequest,
  DeployConfig,
  Profile
} from '../lib/types';
import { createMeeting, deployPrixie, listProfiles } from '../lib/api';
import { CaptureRequestForm } from './CaptureRequestForm';

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
      };

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

          {profiles.length > 0 && (
            <div className="border-t border-primary/20 pt-3">
              <label className={labelClass}>profile / persona</label>
              <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className={inputClass}>
                <option value="">default (no specific profile)</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.display_name}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">select a profile to use its display name, email, and sandboxed context for this meeting</p>
            </div>
          )}
        </div>
      </section>

      {/* 03 attendance */}
      <section className="border border-primary bg-card p-5">
        <div className="border-b border-primary pb-2 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">03 // attendance</span>
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">how prixie checks in</h2>
        </div>
        <div className="space-y-4 text-xs">
          <div>
            <label className={labelClass}>attendance method</label>
            <select value={attendanceMethod} onChange={e => setAttendanceMethod(e.target.value as AttendanceMethod)} className={inputClass}>
              <option value="chat_message">send a chat message</option>
              <option value="google_form">fill out a google form</option>
              <option value="custom">custom method</option>
              <option value="none">no attendance marking</option>
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
          <h2 className="text-base font-bold uppercase tracking-tight text-foreground">what should prixie bring back?</h2>
        </div>
        <div className="space-y-3">
          {captureRequests.map((cr, i) => (
            <div key={i} className="border border-primary/30 bg-background p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">{cr.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{cr.type}</span>
                  {cr.check_chat && <span className="text-leaf">chat</span>}
                  {cr.screenshot && <span className="text-primary">screenshot</span>}
                  <button type="button" onClick={() => handleRemoveCaptureRequest(i)} className="text-red-500 hover:underline">remove</button>
                </div>
              </div>
              {cr.keywords.length > 0 && (
                <p className="mt-1 text-muted-foreground">keywords: {cr.keywords.join(', ')}</p>
              )}
              {cr.notes && <p className="mt-1 text-muted-foreground italic">{cr.notes}</p>}
            </div>
          ))}
          {showAddRequestForm ? (
            <CaptureRequestForm onAdd={handleAddCaptureRequest} onCancel={() => setShowAddRequestForm(false)} />
          ) : (
            <button type="button" onClick={() => setShowAddRequestForm(true)} className="text-xs text-primary hover:underline">
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
            <h2 className="text-base font-bold uppercase tracking-tight text-foreground">zoom breakout behavior</h2>
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <label className={labelClass}>breakout room mode</label>
              <select value={breakoutMode} onChange={e => setBreakoutMode(e.target.value as BreakoutMode)} className={inputClass}>
                <option value="auto_accept_all_invites">auto-accept all invites (default)</option>
                <option value="join_main_room">stay in main room only</option>
                <option value="join_specific_room">join a specific breakout room</option>
              </select>
            </div>
            {breakoutMode === 'join_specific_room' && (
              <div>
                <label className={labelClass}>breakout room id</label>
                <input type="text" placeholder="room id from recall.ai webhook" value={breakoutRoomId} onChange={e => setBreakoutRoomId(e.target.value)} className={inputClass} />
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
