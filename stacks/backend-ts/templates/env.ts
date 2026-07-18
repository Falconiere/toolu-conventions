/** Runtime-validated environment — the one typed source of truth for process config. */

// Bun loads `.env` automatically; every field below is validated here by hand
// (no schema library — see LIBRARIES.md "AVOID: dotenv / zod app-wide"). Add a new
// var by reading `process.env.X` and validating it inline, the same way as these.

type AppEnv = 'production' | 'staging' | 'development';

function toAppEnv(raw: string | undefined): AppEnv {
  if (raw === 'production' || raw === 'staging' || raw === 'development') {
    return raw;
  }
  return 'development';
}

function toPort(raw: string | undefined): number {
  const port = raw !== undefined && raw.length > 0 ? Number(raw) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`[env] PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`);
  }
  return port;
}

export const APP_ENV: AppEnv = toAppEnv(process.env.APP_ENV);
export const PORT: number = toPort(process.env.PORT);
export const IS_PROD: boolean = APP_ENV === 'production';
