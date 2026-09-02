import type { MeetingStatus } from '../lib/types';

interface StatusBadgeProps {
  status: MeetingStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const formatStatus = (s: MeetingStatus) => {
    switch (s) {
      case 'scheduled':
        return 'scheduled';
      case 'joining':
        return 'joining...';
      case 'in_meeting':
        return 'in meeting';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return s;
    }
  };

  const badgeClass = `badge-${status}`;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-mono border uppercase tracking-wider font-semibold ${badgeClass} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-none bg-current opacity-80" />
      {formatStatus(status)}
    </span>
  );
}
