import {
  createRootRouteWithContext,
  HeadContent,
  Scripts
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { SiteShell } from '../components/SiteShell';
import appCss from '../styles.css?url';

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'prixie // personal presence proxy' },
      { name: 'description', content: 'personal meeting proxy agent — go, listen, ask, return' }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap'
      }
    ]
  }),
  shellComponent: RootShell,
  component: RootComponent
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <SiteShell />;
}
