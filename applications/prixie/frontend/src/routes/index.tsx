import { useState, useEffect } from 'react';
import { listMeetings, getStats, checkBackendHealth } from '../lib/api';
import type { Meeting, QuickStats } from '../lib/types';
import { MeetingCard } from '../components/MeetingCard';
import { CapturedItemCard } from '../components/CapturedItemCard';
import { StatusBadge } from '../components/StatusBadge';
import { useNavigate } from '@tanstack/react-router';

export function DashboardPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<QuickStats>({ meetings_attended: 0, items_captured: 0, total_transcripts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const health = await checkBackendHealth();
        setBackendOnline(health.status !== 'offline');

        const [meetingsData, statsData] = await Promise.all([
          listMeetings(),
          getStats().catch(() => ({ meetings_attended: 0, items_captured: 0, total_transcripts: 0 })),
        ]);
        setMeetings(meetingsData);
        setStats(statsData);
      } catch (err: any) {
        setError(err?.message || 'failed to load. is the backend running?');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const upcoming = meetings
    .filter(m => m.status === 'scheduled' || m.status === 'bot_joining' || m.status === 'bot_in_meeting')
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const recent = meetings
    .filter(m => m.status === 'completed')
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 5);

  const allCaptured = meetings
    .flatMap(m => m.captured_items || [])
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground font-mono">
        loading...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* status bar */}
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <span className={`inline-block w-2 h-2 rounded-full ${backendOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        backend: {backendOnline ? 'online' : 'offline'}
        {error && <span className="text-red-500">— {error}</span>}
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-primary bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">meetings attended</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.meetings_attended}</p>
        </div>
        <div className="border border-primary bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">items captured</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.items_captured}</p>
        </div>
        <div className="border border-primary bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">transcripts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.total_transcripts}</p>
        </div>
      </div>

      {/* quick deploy */}
      <button
        onClick={() => navigate({ to: '/deploy' })}
        className="w-full border border-primary bg-primary text-primary-foreground p-3 text-sm font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors font-mono"
      >
        + deploy prixie to a meeting
      </button>

      {/* upcoming meetings */}
      <section>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono">no upcoming meetings.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(m => (
              <MeetingCard key={m.id} meeting={m} onClick={() => navigate({ to: '/meeting/$id', params: { id: m.id } })} />
            ))}
          </div>
        )}
      </section>

      {/* recent captures */}
      {allCaptured.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">recent captures</h2>
          <div className="space-y-3">
            {allCaptured.map(item => (
              <CapturedItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* recent meetings */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">recent meetings</h2>
          <div className="space-y-3">
            {recent.map(m => (
              <MeetingCard key={m.id} meeting={m} onClick={() => navigate({ to: '/meeting/$id', params: { id: m.id } })} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
