// Runtime-validated environment — the app's single typed source of truth for env.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as z from 'zod';

// All public config flows through here so the app has ONE typed source of truth
// for env, declared as a Zod schema: one place to read the shape, one error that
// names every bad field at once, and types inferred from the same declaration
// instead of restated beside it.

type AppVariant = 'prod' | 'test';

function appVariant(): AppVariant {
  const extra: { appVariant?: string } = Constants.expoConfig?.extra ?? {};
  return extra.appVariant === 'prod' ? 'prod' : 'test';
}

function devDefaultApiUrl(): string {
  // Android emulator reaches the host machine via 10.0.2.2, not localhost.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

/** Treats an unset OR empty var as absent, so `.default()` applies to both. */
function optional(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

// IMPORTANT: babel-preset-expo inlines EXPO_PUBLIC_* only at *direct static
// member-access* sites (`process.env.EXPO_PUBLIC_X`). A release Hermes build's
// `process.env` carries no such keys, so naming each var at its full static path
// is what gets the value inlined before validation — otherwise every field
// silently collapses to undefined in production. Read each var into the object
// below (the access site is what matters); never hand `process.env` to the
// schema wholesale, and never use a loop or a dynamic `process.env[name]`.
const EnvSchema = z.object({
  EXPO_PUBLIC_ENV: z
    .enum(['development', 'staging', 'production'])
    .default(__DEV__ ? 'development' : 'production'),
  // `z.url()` rather than a hand-rolled regex: Zod does not lean on Hermes'
  // partial `URL` implementation, so this behaves the same on device as in a test.
  EXPO_PUBLIC_API_URL: z.url().default(devDefaultApiUrl()),
});

/** The logical environment this build targets. */
export type AppEnv = z.infer<typeof EnvSchema>['EXPO_PUBLIC_ENV'];

const parsed = EnvSchema.safeParse({
  EXPO_PUBLIC_ENV: optional(process.env.EXPO_PUBLIC_ENV),
  EXPO_PUBLIC_API_URL: optional(process.env.EXPO_PUBLIC_API_URL),
});

if (!parsed.success) {
  // Thrown at import time, on purpose: a misconfigured build should fail loudly
  // at launch rather than at the first request that needs the bad value.
  throw new Error(`[env] invalid configuration:\n${z.prettifyError(parsed.error)}`);
}

/** Which build variant is installed — drives the app id, icon, and display name. */
export const APP_VARIANT: AppVariant = appVariant();
/** True in a release build. Reflects how the JS was bundled, not which API it talks to. */
export const IS_PROD: boolean = !__DEV__;
/** The logical environment this build targets — the one the API belongs to. */
export const APP_ENV: AppEnv = parsed.data.EXPO_PUBLIC_ENV;
/** Base URL every request in `src/api/` is resolved against. */
export const BASE_API_URL: string = parsed.data.EXPO_PUBLIC_API_URL;
/** Abort budget for a single request, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 8_000;
