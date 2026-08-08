export const STACKS = ["console", "marketing", "backend-ts", "expo", "rust"] as const;
export type StackId = (typeof STACKS)[number];

export const INTEGRATIONS = {
  console: ["api", "auth", "worker-api"],
  marketing: [
    "blog",
    "changelog",
    "ssr-cloudflare",
    "react-island",
    "analytics-posthog",
    "analytics-plausible",
    "analytics-fathom",
  ],
  "backend-ts": ["auth", "structured-logging", "drizzle", "database-package"],
  expo: ["api", "auth", "async-storage"],
  rust: ["clap", "axum", "serde"],
} as const satisfies Record<StackId, readonly string[]>;

export const OPERATIONS = ["cloudflare", "infisical", "local-dev"] as const;
export type OperationId = (typeof OPERATIONS)[number];

export const THEME_PRESETS = ["jade", "blueprint", "ion", "chalk"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export type IntegrationId = (typeof INTEGRATIONS)[StackId][number];

export interface ResolutionFlags {
  targetDirectory?: string;
  stack?: string;
  name?: string;
  displayName?: string;
  integrations?: string[];
  operations?: string[];
  staging?: boolean;
  theme?: string;
  themeFrom?: string;
  pages?: string[];
  domain?: string;
  consoleUrl?: string;
  port?: number;
}
