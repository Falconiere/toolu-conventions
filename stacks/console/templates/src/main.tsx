/** Browser entry — mounts the router inside the app-wide providers. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import { AppProviders } from '@/providers/app-providers';
import { routeTree } from '@/route-tree.gen';
import '@/ui/globals.css';

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

// Registers this router with the library's types so `<Link to="…">`, params and
// search are checked against THIS route tree instead of falling back to `any`.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('[main] #root is missing from index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
