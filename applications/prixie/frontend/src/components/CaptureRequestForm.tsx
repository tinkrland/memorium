import { useState } from 'react';
import type { CaptureRequest, CaptureType } from '../lib/types';

interface CaptureRequestFormProps {
  onAdd: (req: CaptureRequest) => void;
  onCancel?: () => void;
}

export function CaptureRequestForm({ onAdd, onCancel }: CaptureRequestFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CaptureType>('capture');
  const [keywordsText, setKeywordsText] = useState('');
  const [notes, setNotes] = useState('');
  const [checkChat, setCheckChat] = useState(true);
  const [screenshot, setScreenshot] = useState(false);
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const keywords = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    onAdd({
      title: title.trim(),
      type,
      keywords,
      notes: notes.trim(),
      check_chat: checkChat,
      screenshot,
      question: type === 'ask' ? question.trim() : undefined
    });

    // Reset
    setTitle('');
    setType('capture');
    setKeywordsText('');
    setNotes('');
    setCheckChat(true);
    setScreenshot(false);
    setQuestion('');
  };

  return (
    <form onSubmit={handleSubmit} className="border border-primary bg-background p-4 space-y-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-primary pb-2">
        <span className="font-bold uppercase text-primary tracking-wider">add capture request</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            [close]
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-muted-foreground mb-1">request title *</label>
          <input
            type="text"
            required
            placeholder="e.g. hackathon access code"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-primary bg-card p-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-muted-foreground mb-1">type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CaptureType)}
            className="w-full border border-primary bg-card p-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="capture">capture (listen & store)</option>
            <option value="ask">ask (send question in chat)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-muted-foreground mb-1">
          keywords (comma separated)
        </label>
        <input
          type="text"
          placeholder="access code, claim link, forms.gle, github.com"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          className="w-full border border-primary bg-card p-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {type === 'ask' && (
        <div>
          <label className="block text-primary font-bold mb-1">
            question to send in chat *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. what is the targeted quarter for external API release?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full border border-primary bg-card p-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div>
        <label className="block text-muted-foreground mb-1">context / notes</label>
        <textarea
          rows={2}
          placeholder="e.g. look for any link containing forms.gle or slack invite"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full border border-primary bg-card p-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
          <input
            type="checkbox"
            checked={checkChat}
            onChange={(e) => setCheckChat(e.target.checked)}
            className="accent-primary"
          />
          check chat messages
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer text-foreground">
          <input
            type="checkbox"
            checked={screenshot}
            onChange={(e) => setScreenshot(e.target.checked)}
            className="accent-primary"
          />
          take screenshot on match
        </label>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="border border-primary bg-primary px-4 py-1.5 font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          + add request
        </button>
      </div>
    </form>
  );
}
