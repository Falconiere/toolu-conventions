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

export const LAYOUTS = ["standalone", "monorepo"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export const WORKSPACE_PACKAGES = ["database", "ui", "config", "types"] as const;
export type WorkspacePackageId = (typeof WORKSPACE_PACKAGES)[number];

/** Default directory under apps/ for each stack picked in a monorepo. */
export const DEFAULT_APP_DIRECTORIES = {
  console: "console",
  marketing: "marketing",
  "backend-ts": "api",
  expo: "mobile",
  rust: "cli",
} as const satisfies Record<StackId, string>;

export const OPERATIONS = ["cloudflare", "infisical", "local-dev"] as const;
export type OperationId = (typeof OPERATIONS)[number];

export const THEME_PRESETS = ["jade", "blueprint", "ion", "chalk"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export type IntegrationId = (typeof INTEGRATIONS)[StackId][number];

export interface AppFlags {
  id: string;
  stack: string;
  integrations?: string[];
  pages?: string[];
  port?: number;
}

export interface ResolutionFlags {
  targetDirectory?: string;
  layout?: string;
  apps?: AppFlags[];
  packages?: string[];
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
