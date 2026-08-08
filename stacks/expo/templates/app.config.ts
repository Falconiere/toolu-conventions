// Variant-aware Expo app config (DEV / STAGING / PROD). Switches bundle id +
// display name on the build variant so a test build sits beside production.
import type { ExpoConfig } from 'expo/config';

// ── Build variant ────────────────────────────────────────────────────────────
// `test` variant (development / preview / staging builds) gets a distinct bundle
// id + display name so it can sit on a device next to the production app.
// EAS sets APP_VARIANT in the profile's `env`; default to prod when unset.
const VARIANT =
  process.env.APP_VARIANT ?? (process.env.EAS_BUILD_PROFILE === 'production' ? 'prod' : 'test');
const IS_PROD = VARIANT === 'prod';

// ── Identity (fill these in) ─────────────────────────────────────────────────
const APP_NAME = IS_PROD ? '{{TOOLU_DISPLAY_NAME}}' : '{{TOOLU_DISPLAY_NAME}} (Test)';
const SLUG = '{{TOOLU_PROJECT_SLUG}}';
const SCHEME = '{{TOOLU_URL_SCHEME}}';
const IOS_BUNDLE = IS_PROD ? '{{TOOLU_BUNDLE_ID}}' : '{{TOOLU_BUNDLE_ID}}.test';
const ANDROID_PACKAGE = IS_PROD ? '{{TOOLU_ANDROID_PACKAGE}}' : '{{TOOLU_ANDROID_PACKAGE}}.test';
const EAS_PROJECT_ID = '{{TOOLU_EAS_PROJECT_ID}}'; // replace after `eas init`

const config: ExpoConfig = {
  name: APP_NAME,
  slug: SLUG,
  scheme: SCHEME,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  platforms: ['ios', 'android'],
  runtimeVersion: { policy: 'fingerprint' },
  updates: {
    // Set after `eas init`. Auto-download on launch; new JS activates on next cold start.
    url: 'https://u.expo.dev/<eas-project-id>',
    checkAutomatically: 'ON_LOAD',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: { backgroundColor: '#ffffff' },
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: { projectId: EAS_PROJECT_ID },
    // Surfaced to the runtime via expo-constants and read in src/constants/env.ts.
    appVariant: VARIANT,
  },
  // If the EAS project lives under an organization account, add:
  //   owner: '<expo-account>',
};

export default config;
