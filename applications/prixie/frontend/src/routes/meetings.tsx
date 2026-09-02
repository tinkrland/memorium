import { useState, useEffect } from 'react';
import { listMeetings } from '../lib/api';
import { useNavigate } from '@tanstack/react-router';
import type { Meeting } from '../lib/types';
import { MeetingCard } from '../components/MeetingCard';

export function MeetingsPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed'>('all');

  useEffect(() => {
    listMeetings()
      .then(setMeetings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? meetings : meetings.filter(m => {
    if (filter === 'scheduled') return m.status === 'scheduled' || m.status === 'bot_joining' || m.status === 'bot_in_meeting';
    if (filter === 'completed') return m.status === 'completed';
    return true;
  }).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">all meetings</h1>
        <button
          onClick={() => navigate({ to: '/deploy' })}
          className="text-xs font-mono text-primary hover:underline"
        >
          + deploy new
        </button>
      </div>

      <div className="flex gap-2 text-xs font-mono">
        {(['all', 'scheduled', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 border ${filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 text-muted-foreground'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground font-mono">loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">no meetings found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <MeetingCard key={m.id} meeting={m} onClick={() => navigate({ to: '/meeting/$id', params: { id: m.id } })} />
          ))}
        </div>
      )}
    </div>
  );
}
