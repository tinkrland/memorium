import { useState } from 'react';
import type { TranscriptEntry } from '../lib/types';

interface TranscriptViewProps {
  entries: TranscriptEntry[];
}

export function TranscriptView({ entries }: TranscriptViewProps) {
  const [filter, setFilter] = useState('');
  const [highlightsOnly, setHighlightsOnly] = useState(false);

  const filteredEntries = entries.filter((entry) => {
    if (highlightsOnly && !entry.is_highlight) return false;
    if (!filter) return true;
    const search = filter.toLowerCase();
    return (
      entry.speaker.toLowerCase().includes(search) ||
      entry.text.toLowerCase().includes(search) ||
      entry.timestamp.toLowerCase().includes(search)
    );
  });

  return (
    <div className="border border-primary bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 pb-3">
        <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
          transcript ({entries.length} entries)
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={highlightsOnly}
              onChange={(e) => setHighlightsOnly(e.target.checked)}
              className="accent-primary"
            />
            highlights only
          </label>

          <input
            type="text"
            placeholder="search transcript..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-primary bg-background px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="py-8 text-center font-mono text-xs text-muted-foreground">
          {entries.length === 0
            ? 'no transcript available yet. prixie records and diarizes speech during active meetings.'
            : 'no matching transcript lines found.'}
        </div>
      ) : (
        <div className="space-y-3 font-mono text-xs">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 border transition-colors ${
                entry.is_highlight
                  ? 'border-primary bg-primary/10'
                  : 'border-primary/20 bg-background/50 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <span className="font-bold text-primary uppercase tracking-wide">
                  {entry.speaker}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  [{entry.timestamp}]
                </span>
              </div>
              <p className="mt-2 text-foreground/90 leading-relaxed font-mono">
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
