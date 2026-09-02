import { useState, useEffect } from 'react';
import { listMeetings } from '../lib/api';
import type { Meeting } from '../lib/types';
import { CapturedItemCard } from '../components/CapturedItemCard';

export function CapturesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMeetings()
      .then(setMeetings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const allCaptured = meetings
    .filter(m => m.captured_items && m.captured_items.length > 0)
    .flatMap(m => (m.captured_items || []).map(item => ({
      ...item,
      meeting_title: m.title,
    })))
    .sort((a, b) => new Date(b.timestamp || '').getTime() - new Date(a.timestamp || '').getTime());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-lg font-bold text-foreground">captured items</h1>
      
      {loading ? (
        <p className="text-sm text-muted-foreground font-mono">loading...</p>
      ) : allCaptured.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">nothing captured yet. deploy prixie to a meeting to start collecting.</p>
      ) : (
        <div className="space-y-3">
          {allCaptured.map((item, i) => (
            <CapturedItemCard key={item.id || i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
