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
const APP_NAME = IS_PROD ? '<project-name>' : '<project-name> (Test)';
const SLUG = '<project-slug>'; // kebab-case, e.g. my-app
const SCHEME = '<url-scheme>'; // deep-link scheme, e.g. myapp
const IOS_BUNDLE = IS_PROD ? '<bundle-id>' : '<bundle-id>.test';
const ANDROID_PACKAGE = IS_PROD ? '<android-package>' : '<android-package>.test';
const EAS_PROJECT_ID = '<eas-project-id>'; // from `eas init`

// Icon set switches with variant: test builds use the dev icon, prod the prod icon.
const ICON_DIR = IS_PROD ? './assets/icons/prod' : './assets/icons/dev';

const config: ExpoConfig = {
  name: APP_NAME,
  slug: SLUG,
  scheme: SCHEME,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: `${ICON_DIR}/icon.png`,
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
    adaptiveIcon: {
      foregroundImage: `${ICON_DIR}/adaptive-icon.png`,
      backgroundColor: '#ffffff',
    },
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
