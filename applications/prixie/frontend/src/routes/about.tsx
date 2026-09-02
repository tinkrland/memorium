export function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-lg font-bold text-foreground">about prixie</h1>

      <p className="text-sm leading-relaxed text-foreground">
        prixie is a personal presence proxy for people who need something from a meeting, event, or digital session
        without needing to be there themselves.
      </p>

      <p className="text-sm leading-relaxed text-foreground">
        the product starts with a direct instruction. a person tells prixie where to go and what information to bring
        back. prixie handles the presence, follows the session, asks approved questions, and returns the requested
        answer. the full source material can remain available without becoming mandatory reading.
      </p>

      <p className="text-sm leading-relaxed text-muted-foreground">
        prixie is for people with overloaded calendars, inconvenient timezones, conflicting obligations, limited
        attention, or a simple preference not to spend an hour acquiring one fact.
      </p>

      <div className="border border-primary bg-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">principles</p>
        <ul className="space-y-2 text-sm text-foreground">
          <li>— joins silently, camera and mic off by default</li>
          <li>— listens for what you asked for, not a generic summary</li>
          <li>— asks your pre-specified questions when the floor opens</li>
          <li>— captures codes, links, form URLs, and answers</li>
          <li>— returns with the transcript, not more work</li>
          <li>— operates autonomously — you sleep, prixie attends</li>
          <li>— sandboxed profiles — hackathon identity ≠ professional identity</li>
        </ul>
      </div>

      <div className="border border-primary/30 bg-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">platforms</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="text-foreground">zoom — <span className="text-leaf">supported</span></div>
          <div className="text-foreground">google meet — <span className="text-leaf">supported</span></div>
          <div className="text-foreground">microsoft teams — <span className="text-leaf">supported</span></div>
          <div className="text-foreground">slack huddles — <span className="text-amber-500">partial</span></div>
          <div className="text-foreground">cisco webex — <span className="text-amber-500">partial</span></div>
          <div className="text-foreground">discord — <span className="text-muted-foreground">browserbase</span></div>
          <div className="text-foreground">bluejeans — <span className="text-muted-foreground">browserbase</span></div>
          <div className="text-foreground">ringcentral — <span className="text-muted-foreground">browserbase</span></div>
        </div>
      </div>
    </div>
  );
}
