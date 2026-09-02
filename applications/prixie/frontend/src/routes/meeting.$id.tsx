import { useState, useEffect } from 'react';
import { getMeeting, getTranscript } from '../lib/api';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { Meeting, TranscriptData } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { TranscriptView } from '../components/TranscriptView';
import { CapturedItemCard } from '../components/CapturedItemCard';

export function MeetingDetailPage() {
  const { id } = useParams({ from: '/meeting/$id' });
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const m = await getMeeting(id);
        setMeeting(m);
        if (m.status === 'completed') {
          const t = await getTranscript(id).catch(() => null);
          setTranscript(t);
        }
      } catch (err: any) {
        setError(err?.message || 'failed to load meeting');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground font-mono">loading...</div>;
  if (error) return <div className="py-20 text-center text-sm text-red-500 font-mono">{error}</div>;
  if (!meeting) return <div className="py-20 text-center text-sm text-muted-foreground font-mono">meeting not found</div>;

  const startTime = new Date(meeting.start_time).toLocaleString();
  const capturedItems = meeting.captured_items || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate({ to: '/' })}
        className="text-xs text-muted-foreground hover:text-foreground font-mono"
      >
        ← back
      </button>

      {/* meeting header */}
      <div className="border border-primary bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">{meeting.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              {meeting.platform} · {startTime}
            </p>
            {meeting.instruction && (
              <p className="mt-3 text-sm text-foreground italic border-l-2 border-primary/30 pl-3">
                "{meeting.instruction}"
              </p>
            )}
          </div>
          <StatusBadge status={meeting.status} />
        </div>

        {/* config summary */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">join delay:</span>{' '}
            <span className="text-foreground">{meeting.join_delay_minutes} min</span>
          </div>
          <div>
            <span className="text-muted-foreground">attendance:</span>{' '}
            <span className="text-foreground">{meeting.attendance_method}</span>
          </div>
          <div>
            <span className="text-muted-foreground">camera:</span>{' '}
            <span className="text-foreground">{meeting.camera_off ? 'off' : 'on'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">mic:</span>{' '}
            <span className="text-foreground">{meeting.mic_off ? 'off' : 'on'}</span>
          </div>
        </div>
      </div>

      {/* captured items */}
      {capturedItems.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">captured items</h2>
          <div className="space-y-3">
            {capturedItems.map(item => (
              <CapturedItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* capture requests */}
      {meeting.capture_requests && meeting.capture_requests.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">capture requests</h2>
          <div className="space-y-2">
            {meeting.capture_requests.map((cr, i) => (
              <div key={cr.id || i} className="border border-primary/30 bg-card p-3 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{cr.title}</span>
                  <span className={
                    cr.status === 'captured' ? 'text-green-500' :
                    cr.status === 'pending' ? 'text-amber-500' :
                    cr.status === 'not_found' ? 'text-red-500' :
                    'text-muted-foreground'
                  }>{cr.status || 'pending'}</span>
                </div>
                {cr.keywords && cr.keywords.length > 0 && (
                  <p className="mt-1 text-muted-foreground">keywords: {cr.keywords.join(', ')}</p>
                )}
                {cr.captured_content && (
                  <p className="mt-2 text-foreground border-l-2 border-primary/20 pl-2 italic">{cr.captured_content}</p>
                )}
                {cr.captured_chat_links && cr.captured_chat_links.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {cr.captured_chat_links.map((link, j) => (
                      <a key={j} href={link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {link}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* transcript */}
      {transcript && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">transcript</h2>
          {transcript.summary && (
            <div className="border border-primary/30 bg-card p-3 mb-3 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">summary</p>
              <p className="text-foreground">{transcript.summary}</p>
            </div>
          )}
          {transcript.full_transcript && (
            <TranscriptView transcript={transcript.full_transcript} />
          )}
        </section>
      )}

      {/* live status */}
      {(meeting.status === 'bot_joining' || meeting.status === 'bot_in_meeting') && (
        <div className="border border-amber-500/40 bg-amber-500/5 p-4 text-sm font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-2" />
          prixie is {meeting.status === 'bot_joining' ? 'joining' : 'in'} the meeting...
        </div>
      )}
    </div>
  );
}
