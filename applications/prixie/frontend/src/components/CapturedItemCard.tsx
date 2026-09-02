import { useState } from 'react';
import type { CapturedItem } from '../lib/types';

interface CapturedItemCardProps {
  item: CapturedItem;
}

export function CapturedItemCard({ item }: CapturedItemCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(item.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      }).toLowerCase();
    } catch {
      return isoString;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'code':
        return 'bg-primary text-primary-foreground';
      case 'form':
        return 'bg-leaf text-white';
      case 'link':
        return 'border border-primary text-primary bg-background';
      case 'screenshot':
        return 'bg-amber-800 text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const isUrl = item.value.startsWith('http://') || item.value.startsWith('https://');

  return (
    <div className="border border-primary bg-card p-4 transition-all hover:border-primary/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${getTypeBadgeClass(item.type)}`}>
            {item.type}
          </span>
          <span className="font-mono text-xs font-semibold uppercase text-primary">
            {item.title}
          </span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatTime(item.timestamp)}
        </span>
      </div>

      <div className="my-3 rounded-none border border-primary/40 bg-background/80 p-3 font-mono text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="break-all font-mono font-bold text-foreground">
            {isUrl ? (
              <a
                href={item.value}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                {item.value}
              </a>
            ) : (
              <span>{item.value}</span>
            )}
          </div>
          <button
            onClick={copyToClipboard}
            className="shrink-0 border border-primary bg-primary px-2 py-1 font-mono text-[11px] text-primary-foreground hover:opacity-90 active:scale-95"
          >
            {copied ? 'copied!' : 'copy'}
          </button>
        </div>
      </div>

      {item.context && (
        <p className="border-l-2 border-primary pl-2 font-mono text-xs text-muted-foreground italic">
          "{item.context}"
        </p>
      )}

      {item.screenshot_url && (
        <div className="mt-3 overflow-hidden border border-primary">
          <img
            src={item.screenshot_url}
            alt={item.title}
            className="h-32 w-full object-cover grayscale hover:grayscale-0 transition-all duration-300"
          />
        </div>
      )}

      {item.meeting_title && (
        <div className="mt-3 border-t border-primary/20 pt-2 font-mono text-[11px] text-muted-foreground">
          from: <span className="font-semibold text-foreground">{item.meeting_title}</span>
        </div>
      )}
    </div>
  );
}
