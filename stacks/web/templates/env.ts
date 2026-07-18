/** Runtime-validated public environment — one typed source of truth for config. */

// All public config flows through here so the app validates env in one place.
// Validation is hand-written (no schema library) — keep it that way and add
// fields as integrations are wired.

type AppEnv = 'production' | 'staging' | 'development';

function isAppEnv(value: string | undefined): value is AppEnv {
  return value === 'production' || value === 'staging' || value === 'development';
}

// Lightweight URL check — keeps the baseline dependency-free. Tighten if needed.
function requireHttpUrl(value: string, name: string): string {
  if (!/^https?:\/\/.+/.test(value)) {
    throw new Error(`[env] ${name} must be an http(s) URL, got: ${JSON.stringify(value)}`);
  }
  return value;
}

// IMPORTANT: Next.js inlines NEXT_PUBLIC_* only at *direct static member-access*
// sites (`process.env.NEXT_PUBLIC_X`). Read each var into a local by its full
// static path so the value is substituted into the client bundle before
// validation runs — do not refactor into a loop or dynamic `process.env[name]`
// access, or every field collapses to undefined in the production build.
const RAW_ENV: string | undefined = process.env.NEXT_PUBLIC_ENV;
const RAW_API_URL: string | undefined = process.env.NEXT_PUBLIC_API_URL;
const IS_PROD_BUILD = process.env.NODE_ENV === 'production';

export const APP_ENV: AppEnv = isAppEnv(RAW_ENV) ? RAW_ENV : IS_PROD_BUILD ? 'production' : 'development';
export const IS_PROD: boolean = APP_ENV === 'production';
export const BASE_API_URL: string = requireHttpUrl(
  RAW_API_URL !== undefined && RAW_API_URL.length > 0 ? RAW_API_URL : 'http://localhost:3000',
  'NEXT_PUBLIC_API_URL',
);
export const REQUEST_TIMEOUT_MS = 8_000;
