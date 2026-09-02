import { Link } from '@tanstack/react-router';
import type { Meeting } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).toLowerCase();
    } catch {
      return isoString;
    }
  };

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'zoom':
        return 'zoom';
      case 'google_meet':
        return 'google meet';
      case 'teams':
        return 'ms teams';
      default:
        return platform;
    }
  };

  const itemsCount = meeting.captured_items?.length || 0;
  const requestsCount = meeting.capture_requests?.length || 0;

  return (
    <div className="border border-primary bg-card p-4 transition-all hover:border-primary/80">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-primary/30 pb-3">
        <div className="flex items-center gap-2">
          <span className="bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {getPlatformLabel(meeting.platform)}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(meeting.start_time)}
          </span>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      <div className="my-3">
        <h3 className="font-mono text-base font-bold lowercase text-foreground">
          {meeting.title}
        </h3>
        <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
          {meeting.join_url}
        </p>
      </div>

      {meeting.instruction && (
        <p className="my-2 border-l-2 border-primary bg-background/50 p-2 font-mono text-xs text-foreground/90 italic">
          "{meeting.instruction}"
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-primary/30 pt-3 text-xs font-mono">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{itemsCount} {itemsCount === 1 ? 'item captured' : 'items captured'}</span>
          <span>•</span>
          <span>{requestsCount} {requestsCount === 1 ? 'request' : 'requests'}</span>
        </div>

        <Link
          to="/meeting/$id"
          params={{ id: meeting.id }}
          className="border border-primary bg-primary px-3 py-1 font-mono text-xs font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
        >
          view details →
        </Link>
      </div>
    </div>
  );
}
