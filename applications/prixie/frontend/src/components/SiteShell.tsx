import { Link, Outlet, useRouterState } from '@tanstack/react-router';

const primaryLinks = [
  { to: '/', label: 'dashboard' },
  { to: '/meetings', label: 'meetings' },
  { to: '/deploy', label: 'deploy proxy' },
  { to: '/captures', label: 'captured items' },
  { to: '/memorium', label: 'memorium' },
  { to: '/about', label: 'about' }
] as const;

export function SiteShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const getCurrentDocLabel = () => {
    if (pathname === '/') return 'dashboard';
    if (pathname.startsWith('/meetings')) return 'meetings';
    if (pathname.startsWith('/meeting/')) return 'meeting detail';
    if (pathname.startsWith('/deploy')) return 'deploy';
    if (pathname.startsWith('/captures')) return 'captures';
    if (pathname.startsWith('/memorium')) return 'memorium';
    if (pathname.startsWith('/about')) return 'about';
    return pathname.replace('/', '');
  };

  return (
    <div className="flex min-h-full flex-col font-mono text-foreground bg-background">
      {/* Side watermark banner */}
      <div className="pointer-events-none fixed top-0 left-0 z-20 hidden h-full w-8 items-center justify-center lg:flex">
        <span
          className="font-mono text-[9px] whitespace-nowrap text-primary uppercase tracking-[0.25em] opacity-40"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          prixie — personal presence proxy — go, listen, ask, return
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background">
        <div className="flex border border-primary">
          <div className="flex items-center border-r border-primary px-4 py-2">
            <Link
              to="/"
              className="font-mono text-xl leading-none font-black tracking-tight text-primary uppercase"
            >
              prixie
            </Link>
          </div>
          <div className="hidden flex-1 flex-col justify-center border-r border-primary px-3 py-1.5 sm:flex">
            <div className="text-[9px] uppercase tracking-[0.18em] text-primary opacity-60">type</div>
            <div className="text-xs text-foreground">personal presence proxy</div>
          </div>
          <div className="hidden flex-col justify-center border-r border-primary px-3 py-1.5 md:flex">
            <div className="text-[9px] uppercase tracking-[0.18em] text-primary opacity-60">status</div>
            <div className="text-xs text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-none bg-leaf inline-block animate-pulse" />
              <span>active</span>
            </div>
          </div>
          <div className="hidden flex-col justify-center px-3 py-1.5 md:flex">
            <div className="text-[9px] uppercase tracking-[0.18em] text-primary opacity-60">doc</div>
            <div className="text-xs text-foreground">{getCurrentDocLabel()}</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="overflow-x-auto border-x border-b border-primary px-3 py-2 bg-background">
          <nav className="flex items-center gap-4 whitespace-nowrap" aria-label="primary navigation">
            {primaryLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeOptions={{ exact: true }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground lowercase font-mono"
                activeProps={{
                  className: 'text-xs text-primary font-bold underline underline-offset-4 lowercase font-mono'
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:pl-8 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 lg:pl-8 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <div className="border border-t-2 border-primary bg-card">
            <div className="border-b border-primary px-4 py-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-primary opacity-70">
                prixie // personal presence proxy
              </span>
            </div>
            <div className="flex flex-col sm:flex-row">
              <div className="flex-1 border-b border-primary px-4 py-5 sm:border-b-0 sm:border-r">
                <div className="font-mono text-xl font-black tracking-tight text-foreground uppercase">
                  prixie
                </div>
                <div className="mt-1 text-xs text-muted-foreground lowercase">personal meeting proxy agent</div>
                <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground lowercase">
                  prixie is personal by design. it joins meetings on your behalf, marks attendance, captures codes and links, and returns with the transcript.
                </p>
              </div>
              <div className="flex items-center justify-center px-6 py-5">
                <div
                  className="flex items-center justify-center border border-primary bg-background"
                  style={{ width: 80, height: 80, transform: 'rotate(45deg)' }}
                >
                  <div style={{ transform: 'rotate(-45deg)' }} className="text-center">
                    <div className="text-[8px] leading-tight font-bold uppercase tracking-[0.08em] text-primary">
                      go
                      <br />
                      listen
                      <br />
                      return
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
