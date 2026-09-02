import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import './styles.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root')!;
import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

createRoot(root).render(<RouterProvider router={router} />);
