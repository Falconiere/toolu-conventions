/** Root route — the shell every other route renders inside. */
import { Outlet, createRootRoute } from '@tanstack/react-router';

// `__root.tsx` is one of two filenames TanStack Router owns (the other is the
// generated route tree), which is why kebab-case is off under src/app. Keep this
// file a shell: chrome that is on every screen, and nothing else. App-wide
// providers live in src/providers and mount in src/main.tsx.
export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return <Outlet />;
}
