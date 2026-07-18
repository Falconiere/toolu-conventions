// Runtime-validated environment — the app's single typed source of truth for env.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// All public config flows through here so the app has ONE typed source of truth
// for env. Validation is hand-written (no schema library) — keep it that way and
// add fields as integrations are wired.

type AppVariant = 'prod' | 'test';
type AppEnv = 'production' | 'staging' | 'development';

function appVariant(): AppVariant {
  const extra: { appVariant?: string } = Constants.expoConfig?.extra ?? {};
  return extra.appVariant === 'prod' ? 'prod' : 'test';
}

function devDefaultApiUrl(): string {
  // Android emulator reaches the host machine via 10.0.2.2, not localhost.
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

function isAppEnv(value: string | undefined): value is AppEnv {
  return value === 'production' || value === 'staging' || value === 'development';
}

// Lightweight URL check. Avoids relying on Hermes' partial `URL` implementation
// and keeps the baseline dependency-free — tighten the rule if you need to.
function requireHttpUrl(value: string, name: string): string {
  if (!/^https?:\/\/.+/.test(value)) {
    throw new Error(`[env] ${name} must be an http(s) URL, got: ${JSON.stringify(value)}`);
  }
  return value;
}

// IMPORTANT: babel-preset-expo inlines EXPO_PUBLIC_* only at *direct static
// member-access* sites (`process.env.EXPO_PUBLIC_X`). A release Hermes build's
// `process.env` carries no such keys, so referencing each var by its full static
// path is what gets the value inlined before validation — otherwise every field
// silently collapses to undefined in production. Read each var into a local here
// (the access site is what matters); do not refactor this into a loop or dynamic
// `process.env[name]` access.
const RAW_ENV: string | undefined = process.env.EXPO_PUBLIC_ENV;
const RAW_API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL;

export const APP_VARIANT: AppVariant = appVariant();
export const IS_PROD: boolean = !__DEV__;
export const APP_ENV: AppEnv = isAppEnv(RAW_ENV) ? RAW_ENV : __DEV__ ? 'development' : 'production';
export const BASE_API_URL: string = requireHttpUrl(
  RAW_API_URL !== undefined && RAW_API_URL.length > 0 ? RAW_API_URL : devDefaultApiUrl(),
  'EXPO_PUBLIC_API_URL',
);
export const REQUEST_TIMEOUT_MS = 8_000;
